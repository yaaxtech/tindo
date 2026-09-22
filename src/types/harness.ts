// Tipos do Painel do Harness — espelham o blob empurrado por
// ~/.claude/orquestracao/publicar-painel.mjs para a tabela harness_snapshot.
// Colunas em snake_case (vêm do JSON cru do ledger); domínio em camelCase.

export interface LedgerLinha {
  ts: string;
  ts_fechado?: string | null;
  frente: 'codex' | 'kimi' | 'claude' | 'cerebro';
  modelo: string;
  effort: string | null;
  terreno: 'ui' | 'rotina' | 'dificil' | 'mecanico' | 'sql' | 'analise';
  // "pendente" = linha provisória gravada pelos run.sh dos workers antes da
  // revisão do cérebro (2026-08-10). Fica FORA de todos os KPIs da tela.
  // "infra" = worker nunca rodou por falha do lançador. Fica fora da qualidade.
  resultado:
    | 'ok1'
    | 'retrabalho'
    | 'escalado'
    | 'falhou'
    | 'infra'
    | 'quota'
    | 'descartado'
    | 'pendente';
  /** Texto livre existe apenas em snapshots antigos; o contrato v2 não o publica. */
  tarefa?: string;
  /** Texto livre existe apenas em snapshots antigos; o contrato v2 não o publica. */
  nota?: string | null;
  dur: number | null;
  /** Duração automática extraída de `nota` antes de remover o texto livre. */
  exec_min?: number | null;
  /** Id do registro provisório (só em linhas gravadas pelos run.sh). */
  id?: string;
  /** true quando a linha foi gravada automaticamente pelo run.sh. */
  auto?: boolean;
  /**
   * true quando o terreno NÃO foi declarado no despacho e o run.sh caiu no
   * default dele (`rotina` no codex, `ui` no kimi). Gravado desde 13/08/2026;
   * `ledger.mjs fechar --terreno <real>` limpa a marca. Ver `terrenoAmbiguo`
   * em src/lib/harness/kpis.ts.
   */
  terreno_inferido?: boolean;
  /** Papel carimbado no despacho. Ausente não entra em nenhuma decisão. */
  papel?: 'construtor' | 'revisor';
  /** true = papel deduzido depois por texto; fica fora de decisões. */
  papel_inferido?: boolean;
  /** Terreno e papel foram informados no lançamento; não é backfill histórico. */
  classificacao?: 'declarada';
}

export interface KpiHistoricoLinha {
  schema_version?: number;
  metric_version?: string;
  ts: string;
  janela_dias: number;
  n: number;
  ok1_pct: number | null;
  offload_pct: number | null;
  quota_hit_pct: number | null;
  reciclo_pct: number | null;
  dur_mediana_min: number | null;
  por_frente: Record<string, number>;
  nota?: string | null;
}

export interface SaudeDadosHarness {
  schema_version: number;
  metric_version: string;
  gerado_em: string;
  source_max_ts: string | null;
  atraso_fonte_seg: number | null;
  eventos_recebidos: number;
  eventos_publicados: number;
  eventos_rejeitados: number;
  rejeicoes_por_motivo?: Record<string, number>;
  papel_explicito: number;
  papel_explicito_pct: number | null;
  duracao_preenchida: number;
  duracao_preenchida_pct: number | null;
  /** Snapshots antigos preservados só localmente por usarem a fórmula v1. */
  historico_legado?: number;
}

export interface IntervaloConfianca {
  min: number;
  max: number;
}

export interface MetricasConstrucaoPublicadas {
  total: number;
  julgados: number;
  ok1: number;
  retrabalho: number;
  aceitas: number;
  pendente: number;
  quota: number;
  infra: number;
  descartado: number;
  qualidade: number | null;
  retrabalho_pct: number | null;
  qualidade_ic95: IntervaloConfianca | null;
  offload: number;
  offload_pct: number | null;
  quota_pct: number | null;
  duracao: { n: number; p50_min: number | null; p90_min: number | null };
  por_frente: Record<string, number>;
  quota_por_frente: Record<string, number>;
}

export interface MetricasRevisaoPublicadas {
  total: number;
  julgados: number;
  problemas_encontrados: number;
  deteccao_pct: number | null;
  deteccao_ic95: IntervaloConfianca | null;
}

export interface MetricasPeriodoPublicadas {
  dias: number;
  atual: {
    eventos: number;
    construcao: MetricasConstrucaoPublicadas;
    revisao: MetricasRevisaoPublicadas;
  };
  anterior: {
    eventos: number;
    construcao: MetricasConstrucaoPublicadas;
    revisao: MetricasRevisaoPublicadas;
  };
  inicio_atual: string;
  fim_atual: string;
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
  // Alavanca de ESFORÇO do terreno (enriquecida em painel.mjs a partir de
  // defaults-terreno.json e empurrada no mesmo blob). Quando `modelo_no_teto`
  // é true, o modelo já está no piso===teto (ex.: SQL em Opus 5) e o esforço
  // vira a ÚNICA alavanca que o motor pode puxar — por isso o sinal de "subir
  // modelo" abaixo do alvo precisa virar "subir esforço" aqui. Ver kpis.ts.
  effort?: string;
  effort_teto?: string;
  modelo_no_teto?: boolean;
}

export interface ExperimentoBracoPublicado {
  id: string;
  modelo: string;
  effort: string;
  execucoes: number;
  julgados: number;
  ok1: number;
  retrabalho: number;
  quota: number;
  infra: number;
  tokens_mediana: number | null;
  duracao_mediana_min: number | null;
  /** Cobertura opcional da medição adicionada pelo publicador. */
  tokens_medidos?: number | null;
  modelos_confirmados?: number | null;
  pendentes?: number | null;
  falhas?: number | null;
  duracoes_medidas?: number | null;
}

export interface ExperimentoPublicado {
  id: string;
  terreno: string;
  /** Metadado histórico; não separa rotas ou amostras atuais. */
  frente?: string;
  status: string;
  motivo: string;
  bracos: ExperimentoBracoPublicado[];
}

export interface ExperimentosPublicados {
  gerado_em: string;
  experimentos: ExperimentoPublicado[];
}

export interface BenchmarkModeloPublicado {
  id: string;
  nome: string;
  organizacao: string;
  score: number;
  score_margem: number | null;
  sessoes: number;
  output_tokens_mediana: number | null;
  amostra_tokens: number;
}

export interface BenchmarkModelosPublicado {
  fonte: string;
  url: string;
  consultado_em: string;
  projecao: string;
  nota: string;
  modelos: BenchmarkModeloPublicado[];
}

export interface AutorregulacaoPublicada {
  habilitada: boolean;
  gerado_em: string;
  motivo: string;
  ultima_mudanca: string | null;
}

export interface AutonomiaDia {
  data: string; // 'YYYY-MM-DD'
  perguntas: number;
  aceitou: number; // clicou na 1ª opção (sempre a recomendada)
  outra: number; // clicou em outra opção da lista
  corrigiu: number; // respondeu fora da lista, trazendo regra que só ele sabia
  ignorou: number; // dispensou a pergunta sem responder
  esperas_longas: number; // perguntas >1h na tela sem resposta
  espera_mediana_min: number | null;
  espera_p90_min: number | null;
}

export interface AutonomiaN2 {
  carimbadas: number; // decisões que o assistente tomou sozinho e carimbou p/ revisão
  desfeitas: number; // quantas o dono mandou desfazer
  por_dia: Record<string, { carimbadas: number; desfeitas: number }>;
}

export interface AutonomiaCodexDia {
  data: string;
  perguntas: number;
  respondidas: number;
  pendentes: number;
}

/** Perguntas do Codex, separadas porque não têm as mesmas respostas do Claude. */
export interface AutonomiaCodex {
  disponivel?: boolean;
  dias: number;
  gerado_em: string;
  source_max_ts?: string | null;
  erros_leitura?: number;
  motivo?: string | null;
  perguntas_por_dia: AutonomiaCodexDia[];
}

export interface AutonomiaBlob {
  dias: number;
  gerado_em: string;
  perguntas_por_dia: AutonomiaDia[];
  n2: AutonomiaN2 | null;
  /** Fonte Codex opcional; não se mistura com aceite/correção do Claude. */
  codex?: AutonomiaCodex | null;
}

// ── Janela de contexto das sessões do Claude (bloco "Janela" do painel) ────
// Sub-blob do harness_snapshot, empurrado de hora em hora pelo coletor do Mac.
// Qualquer KPI pode vir null (dado insuficiente) e o campo inteiro pode vir
// ausente ou como { erro } quando a coleta falhou — ver src/lib/harness/janela.ts.

export interface JanelaTotais {
  sessoes: number;
  chamadas: number;
  tokens: number;
  cache_read: number;
  output: number;
}

export interface JanelaKpis {
  /** Fração do gasto que é releitura da conversa (cache_read / tokens). */
  pct_prefixo: number | null;
  /** Fração do gasto depois da chamada 200 de cada sessão. */
  pct_pos_200: number | null;
  /** Sessões que passaram do limite medido pela coleta. */
  sessoes_acima_teto: {
    n: number;
    pct: number;
    teto: number;
    /** Snapshot novo mede tokens; ausente = corte histórico por chamadas. */
    unidade_teto?: 'chamadas' | 'tokens';
    /** Fonte a que o corte se aplica; ausente = snapshot legado. */
    escopo?: 'claude' | 'codex';
  } | null;
  /** Custo de contexto médio por tarefa entregue, em tokens, quando há vínculo real. */
  tokens_por_tarefa: number | null;
  /** Explica por que tokens_por_tarefa não está disponível. */
  motivo_tokens_por_tarefa?: string | null;
  /** Gestos de higiene da janela (subagente, chip, compactar, mensagem entre chats). */
  gestos: {
    subagentes: number;
    chips: number;
    compacts: number;
    /**
     * Mensagens entre chats — gesto medido só a partir de 2026-08-15.
     * Ausente/null em snapshot anterior: é "sem sinal", nunca zero.
     */
    mensagens?: number | null;
    /** Fração das sessões que usaram o gesto. Ausente pelo mesmo motivo. */
    pct_sessoes_com_mensagem?: number | null;
    por_sessao: number;
  } | null;
}

export interface JanelaModelo {
  modelo: string;
  chamadas: number;
  tokens: number;
  pct: number;
}

export interface JanelaFaixa {
  faixa: string;
  sessoes: number;
  tokens: number;
  /** Fração do consumo total de tokens nesta faixa. */
  pct: number;
}

export interface JanelaSessao {
  id: string;
  chamadas: number;
  tokens: number;
  modelo: string;
}

export interface JanelaBlob {
  gerado_em: string;
  dias: number;
  totais: JanelaTotais;
  kpis: JanelaKpis;
  por_modelo: JanelaModelo[];
  faixas: JanelaFaixa[];
  top_sessoes: JanelaSessao[];
  /** Medição independente do Codex; não é somada aos totais do Claude. */
  codex?: JanelaCodex | null;
}

export interface JanelaCodexModelo {
  modelo: string;
  chamadas: number;
  tokens: number;
}

export interface JanelaCodexDia {
  data: string;
  perguntas: number;
  respondidas: number;
  pendentes: number;
}

/** Fonte Codex opcional, publicada separada da série histórica do Claude. */
export interface JanelaCodex {
  disponivel: boolean;
  sessoes: number;
  chamadas: number;
  tokens: number;
  input: number;
  cache_read: number;
  output: number;
  source_max_ts: string | null;
  arquivos_lidos: number;
  erros_leitura: number;
  por_modelo: JanelaCodexModelo[];
  perguntas_por_dia: JanelaCodexDia[];
  dias: number;
  gerado_em: string;
}

/** Forma do campo quando a coleta falhou na máquina local. */
export interface JanelaErro {
  erro: string;
  gerado_em: string;
}

/** Campo `janela` do blob: blob normal, erro de coleta, ausente ou null. */
export type JanelaCampo = JanelaBlob | JanelaErro | null;

export interface HarnessBlob {
  schema_version?: number;
  metric_version?: string;
  gerado_em: string;
  as_of?: string;
  ledger: LedgerLinha[];
  metricas_periodos?: Record<string, MetricasPeriodoPublicadas>;
  saude_dados?: SaudeDadosHarness;
  history: KpiHistoricoLinha[];
  volume_codigo: VolumeRepo[];
  prs: PrSemana[];
  assinaturas: Assinatura[];
  cadeias: Record<string, CadeiaTerreno>;
  /** Campo aditivo com resultados A/B medidos pelo publicador. */
  experimentos?: ExperimentosPublicados;
  /** Benchmark externo; contexto de modelo, separado da evidência local. */
  benchmark_modelos?: BenchmarkModelosPublicado;
  /** Campo aditivo com o estado da autorregulação publicada. */
  autorregulacao?: AutorregulacaoPublicada;
  autonomia?: AutonomiaBlob | null;
  janela?: JanelaCampo;
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
  /** Momento em que esta linha foi coletada; ausente em registros legados. */
  coletado_em?: string;
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
  /** Repositório da branch; ausente em snapshots antigos. */
  repo?: string;
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

// ── Snapshot v2 (harness_snapshot.dados com versao: 2) ──────────────────────
// Contrato: ~/.claude/orquestracao/references/harness-v2-contrato.md, seção 6.
// Percentuais 0–100; ausente = null (nunca 0 inventado).

export type ProvedorV2 = 'codex' | 'claude';

export interface DegrauV2 {
  provedor: ProvedorV2;
  modelo: string;
  effort: string;
  rotulo: string;
}

export type EstadoAreaV2 =
  | 'comprovado_mais_barato'
  | 'passa'
  | 'testando_mais_barato'
  | 'quer_subir'
  | 'falhando'
  | 'juntando_dado'
  | 'sem_confianca';

export interface NotaSemanaV2 {
  semana: string;
  valor: number | null;
  qualidade: number | null;
  economia: number | null;
  confianca: number | null;
}

export interface AtencaoV2 {
  id: string;
  tipo: 'proposta_subir' | 'alerta_dado' | 'cota' | 'pendente';
  titulo: string;
  detalhe: string;
  acao: string;
}

export interface AreaV2 {
  id: string;
  nome: string;
  descricao: string;
  risco: boolean;
  meta_ok1: number;
  titular: DegrauV2;
  fallback: DegrauV2 | null;
  teto: DegrauV2 | null;
  escada: DegrauV2[];
  estado: EstadoAreaV2;
  n: number;
  julgados: number;
  ok1: number | null;
  tokens_saida_mediana: number | null;
  duracao_mediana_s: number | null;
  confianca: number | null;
  teste: string | null;
  proposta: string | null;
  ultima_decisao: string | null;
}

export interface BracoV2 {
  rotulo: string;
  modelo: string;
  effort: string;
  n: number;
  julgados: number;
  ok1: number | null;
  meta_n: number;
}

export interface TesteV2 {
  id: string;
  area: string;
  desde: string;
  bracos: BracoV2[];
}

export interface AssinaturaV2 {
  id: 'claude_max_5x' | 'chatgpt_pro_20x' | string;
  conta: string;
  tarefas: number | null;
  tokens_saida: number | null;
  quota_bateu: number | null;
  fallback_acionado: number | null;
}

export interface AderenciaV2 {
  conta: string;
  provedor: string;
  sessoes: number | null;
  na_rota: number | null;
  pct: number | null;
}

export interface DecisaoV2 {
  em: string;
  area: string;
  tipo: string;
  de: string;
  para: string;
  motivo: string;
}

export interface CoberturaV2 {
  modelo: number | null;
  effort: number | null;
  tokens: number | null;
  duracao: number | null;
  area_declarada: number | null;
  veredito: number | null;
}

export interface HarnessV2 {
  versao: 2;
  gerado_em: string;
  periodo: { de: string; ate: string; dias: number };
  nota: {
    valor: number | null;
    qualidade: number | null;
    economia: number | null;
    confianca: number | null;
    meta: number;
    historico: NotaSemanaV2[];
  };
  atencao: AtencaoV2[];
  areas: AreaV2[];
  testes: TesteV2[];
  assinaturas: AssinaturaV2[];
  aderencia: AderenciaV2[];
  decisoes: DecisaoV2[];
  saude: {
    ultima_coleta: string | null;
    cobertura: CoberturaV2;
    por_fonte: Record<string, Partial<CoberturaV2>>;
    erros: { em: string; onde: string; msg: string }[];
  };
  benchmark?: {
    fonte: string;
    data: string;
    modelos: {
      modelo: string;
      effort: string;
      indice: number | null;
      custo_tarefa_usd: number | null;
      tokens_saida_tarefa: number | null;
    }[];
  };
  regras: string[];
}
