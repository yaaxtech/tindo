'use client';

import {
  type HistoricoAlertas,
  getActionsSnapshot,
  getGithubRuns,
  getHarnessAlertas,
  getHarnessSnapshot,
} from '@/services/harness';
import type { ActionsSnapshot, GithubRunLinha, HarnessSnapshot } from '@/types/harness';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface DadosHarness {
  snap: HarnessSnapshot | null;
  githubRuns: GithubRunLinha[] | undefined;
  actionsSnapshot: ActionsSnapshot | null | undefined;
  alertas: HistoricoAlertas | undefined;
  fontes: FontesHarness;
}

export type EstadoFonteHarness = 'carregando' | 'fresco' | 'vazio' | 'anterior' | 'erro';

export interface StatusFonteHarness {
  estado: EstadoFonteHarness;
  /** Origem do dado ou da falha, para o diagnóstico não esconder o culpado. */
  origem: string;
  mensagem: string | null;
  atualizadoEm: string | null;
  /** true quando o dado não tem carimbo confiável ou passou do limite de 6h. */
  velho: boolean;
}

export interface FontesHarness {
  snapshot: StatusFonteHarness;
  githubRuns: StatusFonteHarness;
  minutos: StatusFonteHarness;
  alertas: StatusFonteHarness;
}

export const FONTE_LIMIAR_MS = 6 * 3600e3;
export const FONTE_LIMIARES_MS: Record<keyof FontesHarness, number> = {
  snapshot: FONTE_LIMIAR_MS,
  githubRuns: FONTE_LIMIAR_MS,
  minutos: FONTE_LIMIAR_MS,
  alertas: 16 * 864e5,
};

const fonteCarregando = (origem: string): StatusFonteHarness => ({
  estado: 'carregando',
  origem,
  mensagem: null,
  atualizadoEm: null,
  velho: false,
});

const fontesCarregando = (): FontesHarness => ({
  snapshot: fonteCarregando('snapshot'),
  githubRuns: fonteCarregando('github runs'),
  minutos: fonteCarregando('minutos do GitHub'),
  alertas: fonteCarregando('alertas'),
});

function mensagemDaFalha(motivo: unknown): string {
  return motivo instanceof Error ? motivo.message : String(motivo);
}

function origemDaFalha(motivo: unknown, origemPadrao: string): string {
  const mensagem = mensagemDaFalha(motivo);
  return mensagem.match(/^(harness\/[^:]+)/)?.[1] ?? `harness/${origemPadrao}`;
}

function statusSucesso(
  vazio: boolean,
  origem: string,
  atualizadoEm: string | null,
  agora: number,
  limiarMs: number,
): StatusFonteHarness {
  const tempo = atualizadoEm ? Date.parse(atualizadoEm) : Number.NaN;
  return {
    estado: vazio ? 'vazio' : 'fresco',
    origem,
    mensagem: null,
    atualizadoEm,
    velho: !vazio && (!Number.isFinite(tempo) || agora - tempo > limiarMs),
  };
}

export function fonteVelha(
  fonte: keyof FontesHarness,
  status: StatusFonteHarness,
  agora = Date.now(),
): boolean {
  const tempo = status.atualizadoEm ? Date.parse(status.atualizadoEm) : Number.NaN;
  return (
    status.velho ||
    (status.estado === 'fresco' &&
      (!Number.isFinite(tempo) || agora - tempo > FONTE_LIMIARES_MS[fonte]))
  );
}

function statusFalha(
  motivo: unknown,
  origemPadrao: string,
  anterior: StatusFonteHarness,
): StatusFonteHarness {
  const temLeituraAnterior =
    anterior.estado === 'fresco' || anterior.estado === 'vazio' || anterior.estado === 'anterior';
  return {
    estado: temLeituraAnterior ? 'anterior' : 'erro',
    origem: origemDaFalha(motivo, origemPadrao),
    mensagem: mensagemDaFalha(motivo),
    atualizadoEm: anterior.atualizadoEm,
    velho: temLeituraAnterior,
  };
}

function maiorData(datas: (string | null | undefined)[]): string | null {
  let maior: { texto: string; ms: number } | null = null;
  for (const texto of datas) {
    if (!texto) continue;
    const ms = Date.parse(texto);
    if (Number.isFinite(ms) && (!maior || ms > maior.ms)) maior = { texto, ms };
  }
  return maior?.texto ?? null;
}

export const ERRO_ATUALIZACAO =
  'Atualização parcial: algumas fontes falharam. Os dados disponíveis continuam na tela.';
export const ERRO_CARGA_INICIAL =
  'Não foi possível ler o painel agora. Tente atualizar em instantes.';

/**
 * As quatro fontes do painel, com um único `atualizar()` que busca tudo de
 * novo. O serviço (services/harness.ts) distingue os dois casos: erro de
 * leitura REJEITA, retorno vazio (null/[]) é legítimo. Por isso o hook não
 * adivinha: fonte rejeitada mantém o que já estava na tela e o cabeçalho
 * avisa; fonte vazia substitui, porque é o que o banco tem de fato.
 * Antes, um cronômetro só trocava o "há N min" do carimbo — parecia atualizar
 * e não buscava nada; a idade continua no cabeçalho, mas quem busca dado é isto.
 */
export function useDadosHarness() {
  const [dados, setDados] = useState<DadosHarness>({
    snap: null,
    githubRuns: undefined,
    actionsSnapshot: undefined,
    alertas: undefined,
    fontes: fontesCarregando(),
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const montado = useRef(true);
  // Espelho do snapshot em tela, para o aviso saber se há leitura anterior
  // sem depender de ler estado dentro do updater.
  const snapAtual = useRef<HarnessSnapshot | null>(null);
  useEffect(() => {
    snapAtual.current = dados.snap;
  }, [dados.snap]);

  const atualizar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const [s, g, a, al] = await Promise.allSettled([
      getHarnessSnapshot(),
      getGithubRuns(),
      getActionsSnapshot(),
      getHarnessAlertas(),
    ]);
    if (!montado.current) return;

    const falhou = [s, g, a, al].some((r) => r.status === 'rejected');
    // Snapshot rejeitou sem leitura anterior: o aviso não pode falar em
    // "números abaixo", porque não há nenhum.
    const semLeitura = s.status === 'rejected' && !snapAtual.current;

    const agora = Date.now();
    setDados((prev) => ({
      snap: s.status === 'fulfilled' ? s.value : prev.snap,
      githubRuns: g.status === 'fulfilled' ? g.value : prev.githubRuns,
      actionsSnapshot: a.status === 'fulfilled' ? a.value : prev.actionsSnapshot,
      alertas: al.status === 'fulfilled' ? al.value : prev.alertas,
      fontes: {
        snapshot:
          s.status === 'fulfilled'
            ? statusSucesso(
                s.value === null,
                'snapshot',
                s.value?.geradoEm ?? null,
                agora,
                FONTE_LIMIARES_MS.snapshot,
              )
            : statusFalha(s.reason, 'snapshot', prev.fontes.snapshot),
        githubRuns:
          g.status === 'fulfilled'
            ? statusSucesso(
                g.value.length === 0,
                'github runs',
                maiorData(g.value.map((linha) => linha.coletado_em)),
                agora,
                FONTE_LIMIARES_MS.githubRuns,
              )
            : statusFalha(g.reason, 'github_runs', prev.fontes.githubRuns),
        minutos:
          a.status === 'fulfilled'
            ? statusSucesso(
                a.value === null,
                'minutos do GitHub',
                a.value?.geradoEm ?? null,
                agora,
                FONTE_LIMIARES_MS.minutos,
              )
            : statusFalha(a.reason, 'actions_snapshot', prev.fontes.minutos),
        alertas:
          al.status === 'fulfilled'
            ? statusSucesso(
                al.value.avaliacoes.length === 0,
                'alertas',
                maiorData(al.value.avaliacoes.map((avaliacao) => avaliacao.avaliado_em)),
                agora,
                FONTE_LIMIARES_MS.alertas,
              )
            : statusFalha(al.reason, 'alertas', prev.fontes.alertas),
      },
    }));
    setErro(!falhou ? null : semLeitura ? ERRO_CARGA_INICIAL : ERRO_ATUALIZACAO);
    setCarregando(false);
  }, []);

  useEffect(() => {
    montado.current = true;
    void atualizar();
    return () => {
      montado.current = false;
    };
  }, [atualizar]);

  return { ...dados, carregando, erro, atualizar };
}
