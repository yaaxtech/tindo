/**
 * Porte fiel do modelo de score que o Emanuel usava no Notion (base "RoadMap").
 * Fórmulas coladas por ele em 2026-09-29; ver docs/12_SCORE_NOTION.md.
 *
 * Função pura. Serve de referência para a fase do score único: o TinDo compara
 * a nota atual com esta e, quando ligar, mostra a versão 0–100 (`notaDe0a100`).
 */

export type ImportanciaNotion = 1 | 2 | 3 | 4 | 5;
export type TipoTarefaNotion = 'ganho' | 'dor' | null;

export interface EntradaModeloNotion {
  importancia: ImportanciaNotion | null;
  /** Minutos estimados. Sem valor, o Notion dividia por vazio; aqui assume 15. */
  tempoMinutos: number | null;
  tipoTarefa: TipoTarefaNotion;
  /** Número da meta (o "4" de "4) Chegar 100k/mes receita"); null = sem meta. */
  numeroMeta: number | null;
  dataLimite: Date | null;
  bloqueada: boolean;
  congelada: boolean;
  topoLembrete: boolean;
  /** Projeto com redução de score (no Notion, SeuCamarão = 0,5). */
  reducao: number;
  sumirAte: Date | null;
}

/** 💰 Gold: valor da tarefa em reais aproximados, pela importância. */
export const GOLD_POR_IMPORTANCIA: Record<ImportanciaNotion, number> = {
  5: 30_000,
  4: 7_500,
  3: 2_000,
  2: 550,
  1: 50,
};
const GOLD_SEM_IMPORTANCIA = 7_500;
const TEMPO_PADRAO_MIN = 15;
const HORA_MS = 3_600_000;

export type FaixaUrgencia = 'atrasada' | 'hoje' | 'semana' | 'mes' | 'semestre' | 'ano';

/** 🚨 Urgência: faixa pela distância até a data limite (em horas). */
export function faixaUrgencia(dataLimite: Date | null, agora: Date): FaixaUrgencia {
  if (!dataLimite) return 'mes';
  const horas = (dataLimite.getTime() - agora.getTime()) / HORA_MS;
  if (horas < -24) return 'atrasada';
  if (horas < 0) return 'hoje';
  if (horas < 144) return 'semana';
  if (horas < 629) return 'mes';
  if (horas < 4296) return 'semestre';
  return 'ano';
}

/** 🚨 urgPts */
export const PONTOS_URGENCIA: Record<FaixaUrgencia, number> = {
  atrasada: 1_000_000,
  hoje: 500_000,
  semana: 800,
  mes: 300,
  semestre: 20,
  ano: 10,
};

const TOPO_LEMBRETE = 999_999;

/** 🌟 Score, na escala original do Notion (não é 0–100). */
export function scoreModeloNotion(e: EntradaModeloNotion, agora = new Date()): number {
  if (e.congelada) return 0;
  if (e.bloqueada) return 1;
  if (e.sumirAte && e.sumirAte.getTime() > agora.getTime()) {
    // Escondida: fica negativa, tanto mais quanto mais longe estiver de voltar.
    return Math.round((agora.getTime() - e.sumirAte.getTime()) / 10_000_000);
  }

  const gold = e.importancia ? GOLD_POR_IMPORTANCIA[e.importancia] : GOLD_SEM_IMPORTANCIA;
  const tempo = e.tempoMinutos && e.tempoMinutos > 0 ? e.tempoMinutos : TEMPO_PADRAO_MIN;
  const urg = PONTOS_URGENCIA[faixaUrgencia(e.dataLimite, agora)];
  const tipo = e.tipoTarefa === 'ganho' ? 1.5 : e.tipoTarefa === 'dor' ? 0.7 : 1;
  const meta = e.numeroMeta !== null ? 1 + 0.05 * e.numeroMeta : 1;

  const base = Math.round((gold / tempo + urg) / 10) * e.reducao * tipo * meta;
  return base + (e.topoLembrete ? TOPO_LEMBRETE : 0);
}

/**
 * Leva o score do Notion (de ~1 a ~190 mil, fora o Topo) para 0–100 em escala
 * logarítmica, para caber na nota do TinDo sem perder a ordem.
 */
export function notaDe0a100(score: number): number {
  if (score <= 1) return 0;
  const TETO = 200_000;
  return Math.max(0, Math.min(100, Math.round((Math.log10(score) / Math.log10(TETO)) * 100)));
}

/** Corte do filtro 🚀 do Notion (na escala original). */
export const CORTE_FOGUETE = 66;
