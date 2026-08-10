// Tipos do Painel do Harness — espelham o blob empurrado por
// ~/.claude/orquestracao/publicar-painel.mjs para a tabela harness_snapshot.
// Colunas em snake_case (vêm do JSON cru do ledger); domínio em camelCase.

export interface LedgerLinha {
  ts: string;
  frente: 'codex' | 'kimi' | 'claude' | 'cerebro';
  modelo: string;
  effort: string | null;
  terreno: 'ui' | 'rotina' | 'dificil' | 'mecanico' | 'sql';
  // "pendente" = linha provisória gravada pelos run.sh dos workers antes da
  // revisão do cérebro (2026-08-10). Fica FORA de todos os KPIs da tela.
  resultado: 'ok1' | 'retrabalho' | 'escalado' | 'falhou' | 'quota' | 'pendente';
  tarefa: string;
  nota: string | null;
  dur: number | null;
  /** Id do registro provisório (só em linhas gravadas pelos run.sh). */
  id?: string;
  /** true quando a linha foi gravada automaticamente pelo run.sh. */
  auto?: boolean;
}

export interface KpiHistoricoLinha {
  ts: string;
  janela_dias: number;
  n: number;
  ok1_pct: number | null;
  offload_pct: number | null;
  quota_hit_pct: number | null;
  reciclo_pct: number | null;
  dur_mediana_min: number | null;
  por_frente: Record<string, number>;
  nota: string | null;
}

export interface VolumeRepo {
  nome: string;
  semanas: { s: number; add: number; del: number }[];
}

export interface PrSemana {
  s: number;
  prs: number;
  leadMin: number | null;
}

export interface Assinatura {
  nome: string;
  frente: string;
  valor: number;
  renova: string;
  papel: string;
}

export interface CadeiaTerreno {
  rotulo: string;
  default: string;
  fallback: string[];
  piso: boolean;
  nunca_externo?: boolean;
  revisor: string;
}

export interface HarnessBlob {
  gerado_em: string;
  ledger: LedgerLinha[];
  history: KpiHistoricoLinha[];
  volume_codigo: VolumeRepo[];
  prs: PrSemana[];
  assinaturas: Assinatura[];
  cadeias: Record<string, CadeiaTerreno>;
}

export interface HarnessSnapshot {
  dados: HarnessBlob;
  geradoEm: string;
}
