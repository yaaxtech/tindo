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

// ── Tempos crus do GitHub Actions (tabela harness_github_runs) ──────────────
// Coletados 1×/dia pelo passo do /api/cron/diario. Timestamps CRUS: os
// segmentos são derivados em src/lib/harness/github-timings.ts, para a análise
// poder mudar sem recoletar. Nunca guarda texto livre (título de PR, mensagem
// de commit) — /harness é pública.

/** Uma linha da tabela harness_github_runs (colunas em snake_case). */
export interface GithubRunLinha {
  run_id: number;
  repo: string;
  evento: 'pull_request' | 'push';
  branch: string | null;
  head_sha: string | null;
  /** success | failure | cancelled | … — null enquanto o run não terminou. */
  conclusao: string | null;
  criado_em: string;
  iniciado_em: string | null;
  atualizado_em: string | null;
  pr_numero: number | null;
  pr_criado_em: string | null;
  pr_merged_em: string | null;
}

export type SegmentoGithub = 'fila_ci' | 'exec_ci' | 'espera_merge' | 'deploy';

/** p50/p90 em segundos + tamanho da amostra. Nunca média, nunca `n` escondido. */
export interface ResumoSegmento {
  p50: number | null;
  p90: number | null;
  n: number;
}

export type ResumoGithub = Record<SegmentoGithub, ResumoSegmento>;

export interface SemanaGithub {
  /** 0 = semana corrente, 1 = anterior, … (mesma convenção de PrSemana). */
  s: number;
  segmentos: ResumoGithub;
}

// ── Revisor de KPIs (tabelas harness_avaliacoes / harness_alertas) ──────────
// Avaliação roda no /api/cron/diario e só grava quando o calendário manda
// (14 em 14 dias, ou 3 dias antes de uma renovação de assinatura).
// Nunca guarda texto livre: o código é de lista fechada e a frase em
// português vive na tela — /harness é pública.

/** Cada limiar vigiado. Espelha o CHECK de harness_alertas.codigo. */
export type CodigoAlerta =
  | 'qualidade_baixa'
  | 'retrabalho_alto'
  | 'custo_alto'
  | 'quota_alta'
  | 'quota_zerada'
  | 'valor_baixo'
  | 'espera_merge_longa'
  | `segmento_${SegmentoGithub}`;

export type SeveridadeAlerta = 'alerta' | 'critico';

export type MotivoAvaliacao = 'periodico' | 'pre_renovacao';

/** Uma linha de harness_avaliacoes (colunas em snake_case). */
export interface AvaliacaoLinha {
  id: string;
  avaliado_em: string;
  motivo: MotivoAvaliacao;
  janela_dias: number;
  violacoes_n: number;
}

/** Uma linha de harness_alertas (colunas em snake_case). */
export interface AlertaLinha {
  id: string;
  avaliacao_id: string;
  avaliado_em: string;
  codigo: CodigoAlerta;
  severidade: SeveridadeAlerta;
  /** Valor observado. Unidade depende do código — ver src/lib/harness/alertas.ts. */
  valor: number | null;
  limiar: number;
  amostra: number;
}

// ── Minutos do GitHub Actions (snapshot agregado pelo coletor local) ─────

export interface ActionsDia {
  dia: string;
  repo: string;
  min_faturado: number;
  min_mac: number;
  runs: number;
  jobs: number;
  jobs_falha: number;
  jobs_cancelado: number;
  min_perdido: number;
  fila_seg: number[];
}

export interface ActionsBranch {
  branch: string;
  runs: number;
  min_total: number;
  virou_pr: boolean;
  mergeado: boolean;
}

export interface ActionsStep {
  nome: string;
  seg_total: number;
  n: number;
}

export interface ActionsBlob {
  gerado_em: string;
  ciclo_inicio: string;
  cota_min: number;
  custo_min_usd: number;
  repos: string[];
  dias: ActionsDia[];
  branches: ActionsBranch[];
  steps: ActionsStep[];
  fila_por_hora: { hora: number; p50: number | null; p90: number | null; n: number }[];
  prs_mergeados_ciclo: number;
  destino: { RUNNER_CI: string | null; RUNNER_LEVE: string | null };
  parcial: string | null;
}

export interface ActionsSnapshot {
  dados: ActionsBlob;
  geradoEm: string;
}
