import type { LedgerLinha } from '@/types/harness';
import { percentil } from './github-timings';

const DIA_MS = 864e5;

export const SEGMENTOS_DESPACHO = ['execucao', 'revisao', 'total'] as const;

export type SegmentoDespacho = (typeof SEGMENTOS_DESPACHO)[number];

export interface MedidaDespacho {
  /** Fim da execução do worker, em ms; também ancora o recorte da janela. */
  ts: number;
  frente: LedgerLinha['frente'];
  execucao: number | null;
  revisao: number | null;
  total: number | null;
}

export interface ResumoSegmentoDespacho {
  p50: number | null;
  p90: number | null;
  n: number;
}

export type ResumoDespacho = Record<SegmentoDespacho, ResumoSegmentoDespacho>;
export type ResumoDespachoPorFrente = Record<LedgerLinha['frente'], ResumoDespacho>;

const FRENTES: readonly LedgerLinha['frente'][] = ['codex', 'kimi', 'claude', 'cerebro'];
const VAZIO: ResumoSegmentoDespacho = { p50: null, p90: null, n: 0 };

/** Extrai a duração automática gravada pelo run.sh em `exec=Nmin`. */
export function execMinutos(nota: string | null | undefined): number | null {
  if (!nota) return null;
  const trecho = nota.match(/\bexec=([0-9]+(?:\.[0-9]+)?)min\b/)?.[1];
  if (!trecho) return null;
  const minutos = Number(trecho);
  return Number.isFinite(minutos) ? minutos : null;
}

/** Minutos entre dois instantes; falta, data inválida ou diferença negativa viram null. */
function deltaMinutos(inicio: string, fim: string | null | undefined): number | null {
  if (!fim) return null;
  const a = Date.parse(inicio);
  const b = Date.parse(fim);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const minutos = (b - a) / 60_000;
  return minutos < 0 ? null : minutos;
}

/** Converte o ledger cru em uma medida por linha fechada, sem estimar marcos ausentes. */
export function medidasDoLedger(linhas: LedgerLinha[]): MedidaDespacho[] {
  return linhas
    .filter((linha) => linha.resultado !== 'pendente')
    .map((linha) => {
      const execucao = linha.exec_min ?? execMinutos(linha.nota);
      const revisao = deltaMinutos(linha.ts, linha.ts_fechado);
      return {
        ts: Date.parse(linha.ts),
        frente: linha.frente,
        execucao,
        revisao,
        total: execucao != null && revisao != null ? execucao + revisao : null,
      };
    });
}

function resumir(valores: (number | null)[]): ResumoSegmentoDespacho {
  const validos = valores
    .filter(
      (valor): valor is number => typeof valor === 'number' && Number.isFinite(valor) && valor >= 0,
    )
    .sort((a, b) => a - b);
  if (validos.length === 0) return { ...VAZIO };
  return {
    p50: percentil(validos, 0.5),
    p90: percentil(validos, 0.9),
    n: validos.length,
  };
}

function resumirMedidas(medidas: MedidaDespacho[]): ResumoDespacho {
  return {
    execucao: resumir(medidas.map((medida) => medida.execucao)),
    revisao: resumir(medidas.map((medida) => medida.revisao)),
    total: resumir(medidas.map((medida) => medida.total)),
  };
}

/**
 * Recorte rolante igual a `recorte` em kpis.ts: desloc=0 é o período atual;
 * desloc=1, o período anterior de mesmo tamanho.
 */
export function resumoDespacho(
  medidas: MedidaDespacho[],
  janelaDias: number,
  desloc = 0,
  agora: number = Date.now(),
): ResumoDespacho {
  const ini = agora - (desloc + 1) * janelaDias * DIA_MS;
  const fim = agora - desloc * janelaDias * DIA_MS;
  return resumirMedidas(medidas.filter((medida) => medida.ts >= ini && medida.ts < fim));
}

/** Resume execução, revisão e total separadamente para cada frente conhecida. */
export function porFrente(medidas: MedidaDespacho[]): ResumoDespachoPorFrente {
  return Object.fromEntries(
    FRENTES.map((frente) => [
      frente,
      resumirMedidas(medidas.filter((medida) => medida.frente === frente)),
    ]),
  ) as ResumoDespachoPorFrente;
}
