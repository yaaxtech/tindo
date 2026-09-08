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
}

export const ERRO_ATUALIZACAO =
  'Não foi possível atualizar agora. Os números abaixo são da última leitura que deu certo.';
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

    setDados((prev) => ({
      snap: s.status === 'fulfilled' ? s.value : prev.snap,
      githubRuns: g.status === 'fulfilled' ? g.value : prev.githubRuns,
      actionsSnapshot: a.status === 'fulfilled' ? a.value : prev.actionsSnapshot,
      alertas: al.status === 'fulfilled' ? al.value : prev.alertas,
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
