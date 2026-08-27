// Porta pura e testada da lógica de KPIs do Painel do Harness.
// Fonte: ~/.claude/orquestracao/ledger.mjs (calcKpis) e painel.mjs
// (kpisGerais / kpisTerreno / porModelo / assinaturas). Qualquer mudança na
// governança (limiares do CLAUDE.md global) precisa ser espelhada aqui.

import type {
  Assinatura,
  AutonomiaBlob,
  AutonomiaDia,
  CadeiaTerreno,
  HarnessBlob,
  KpiHistoricoLinha,
  LedgerLinha,
  MetricasConstrucaoPublicadas,
} from '@/types/harness';

const DIA_MS = 864e5;

/** Piso para transformar porcentagem geral em decisão; abaixo disso é só leitura provisória. */
export const MIN_AMOSTRA_GERAL = 20;
export const HARNESS_SCHEMA_VERSION = 2;
export const HARNESS_METRIC_VERSION = 'construction-v2-2026-08-27';
const JANELAS_OBRIGATORIAS = [1, 7, 14, 15, 30] as const;

const FORA_DO_JULGAMENTO = new Set<LedgerLinha['resultado']>([
  'pendente',
  'quota',
  'infra',
  'descartado',
]);

/** Construções carimbadas no despacho. Papel ausente ou deduzido não decide nada. */
export const soConstrucoesExplicitas = (linhas: LedgerLinha[]): LedgerLinha[] =>
  linhas.filter((r) => r.papel === 'construtor' && r.papel_inferido !== true);

/** Revisões carimbadas no despacho, mantidas numa métrica separada da construção. */
export const soRevisoesExplicitas = (linhas: LedgerLinha[]): LedgerLinha[] =>
  linhas.filter((r) => r.papel === 'revisor' && r.papel_inferido !== true);

// "pendente" = provisório dos run.sh sem revisão do cérebro — nunca entra em
// KPI nenhum (contaria como retrabalho e quebraria qualidade/retrabalho).
// Filtrado na ENTRADA de cada função de KPI: blobs antigos (sem pendente)
// passam intactos e blobs novos ficam corretos sem depender do caller.
const semPendentes = (linhas: LedgerLinha[]): LedgerLinha[] =>
  soConstrucoesExplicitas(linhas).filter((r) => r.resultado !== 'pendente');

const ehJulgavel = (r: LedgerLinha): boolean => !FORA_DO_JULGAMENTO.has(r.resultado);

/** Despachos provisórios (run.sh) aguardando revisão — só para a contagem ⏳. */
export const contarPendentes = (linhas: LedgerLinha[]): number =>
  soConstrucoesExplicitas(linhas).filter((r) => r.resultado === 'pendente').length;

/** Despachos cujo worker nunca rodou por falha do lançador. */
export const contarInfra = (linhas: LedgerLinha[]): number =>
  soConstrucoesExplicitas(linhas).filter((r) => r.resultado === 'infra').length;

/** Tarefa ACEITA = entregue de fato (ok1 ou retrabalho) — denominador de custo. */
const ehAceita = (r: LedgerLinha): boolean => r.resultado === 'ok1' || r.resultado === 'retrabalho';

/** Dias cobertos pelo ledger: do despacho mais antigo até agora (mín. 1). */
export function diasComDados(ledger: LedgerLinha[], agora = Date.now()): number {
  if (ledger.length === 0) return 0;
  const tsMaisAntigo = ledger.reduce(
    (maisAntigo, linha) => Math.min(maisAntigo, Date.parse(linha.ts)),
    Number.POSITIVE_INFINITY,
  );
  return Math.max(1, Math.ceil((agora - tsMaisAntigo) / DIA_MS));
}

// Limiares (espelho da governança do harness)
const MIN_N = MIN_AMOSTRA_GERAL; // mesma porta de amostra de toda decisão de qualidade
const OK1_PISO = 0.7; // abaixo → degrau subdimensionado
const OK1_TETO = 0.9; // acima (n>=20, degrau não-mínimo) → candidato a descer
const QUOTA_ALERTA = 3; // eventos de quota na janela → frente saturada
const AMBIGUO_MAX = 0.3; // acima disso o balde não mede terreno — sem sinal

// Os run.sh dos workers gravam um terreno DEFAULT quando o despacho não passa
// LEDGER_TERRENO (`rotina` no codex, `ui` no kimi). Um balde assim mistura o
// terreno real com tudo que o cérebro esqueceu de classificar, e o ok1 dele
// deixa de medir o degrau — trocar o default por causa dele é decidir no ruído.
//
// O terreno só MEDE o degrau quando foi declarado NO DESPACHO. Isso acontece
// em um caso e só nele: despacho automático DEPOIS da instrumentação e SEM a
// marca `terreno_inferido` — o run.sh já carimbava, então a ausência da marca
// prova que a variável veio preenchida. Todo o resto é ambíguo.
//
// O log MANUAL do cérebro também não vale (buraco fechado no ledger.mjs em
// 14/08/2026): terreno digitado à mão DEPOIS do trabalho é rótulo, não
// classificação — foi por aí que leitura barata ("estado da aba Despescas para
// prompt", "inventário e reconciliação") entrou no balde `dificil`. A prova de
// que o sinal era lixo: em 14d o report mandava SUBIR em Sol/xhigh × dificil
// (67%) e DESCER em Sol/high × dificil (94%) — effort MAIOR performando pior no
// MESMO terreno é impossível por effort e natural por seleção de amostra.
//
// Espelho de `terrenoAmbiguo` em ~/.claude/orquestracao/ledger.mjs (fonte de
// verdade) — mudar lá = mudar aqui.
//
// O instante é o momento REAL em que os dois `run.sh` passaram a carimbar
// LEDGER_TERRENO, achado nos transcripts da sessão que aplicou os Edits. O
// valor anterior (17:00Z) era um arredondamento para trás: contava como
// "classificados" os registros de uma janela de ~4h40 que ainda não tinham
// carimbo nenhum, e por isso a tela discordava do `ledger.mjs report`.
const INSTRUMENTACAO_TERRENO = Date.parse('2026-08-13T21:42:23Z');

export function terrenoAmbiguo(r: LedgerLinha): boolean {
  if (r.papel !== 'construtor' || r.papel_inferido === true) return true;
  if (r.terreno_inferido) return true; // o próprio run.sh admitiu o default
  if (!r.auto) return true; // rótulo digitado à mão ≠ classificação
  return Date.parse(r.ts) < INSTRUMENTACAO_TERRENO; // antes do carimbo: indistinguível
}

export interface KpisGerais {
  n: number;
  /** Julgáveis (n − quota − infra): denominador de qualidade/retrabalho. */
  julg: number;
  /** Contagens cruas — para mostrar a amostra "x/y" ao lado de cada %. */
  ok1N: number;
  recN: number;
  offN: number;
  quotaN: number;
  /** Despachos cujo worker nunca rodou (falha de infraestrutura). */
  infraN: number;
  /** Execuções descartadas pelo cérebro; não julgam o worker. */
  descartadoN: number;
  /** Tarefas aceitas (ok1 + retrabalho) — denominador de custo por tarefa. */
  aceitas: number;
  ok1: number | null;
  offload: number | null;
  quotaHit: number | null;
  reciclo: number | null;
  /** Mediana (p50) de despacho→aceite, em minutos. */
  durMed: number | null;
  /** p90 de despacho→aceite, em minutos. */
  durP90: number | null;
  durN: number;
  porFrente: Record<string, number>;
  quotaPorFrente: Record<string, number>;
}

/**
 * `vazio` = nenhum despacho no período (instrumento sem entrada) — é DIFERENTE
 * de `dados`, que já tem registro mas ainda não chegou à amostra mínima. Os
 * dois somem da tela como "sem 🔺/🔻", e confundir um com o outro faz o dono
 * ler "instrumento quebrado" onde só falta tarefa medida.
 */
// `esforco` = ok1 abaixo do piso num terreno cujo modelo já está no teto
// (piso===teto, ex.: SQL/dinheiro em Opus 5). Aí não há "subir o modelo": a
// única alavanca que o motor pode puxar é o ESFORÇO (high→max) — e, esgotado
// esse, reforçar a revisão. Distinto de `subir`, que ainda tem modelo pra cima.
export type SinalTipo =
  | 'vazio'
  | 'dados'
  | 'subir'
  | 'esforco'
  | 'baratear'
  | 'ok'
  | 'quota'
  | 'ambiguo';

export interface TerrenoKpi {
  n: number;
  julgaveis: number;
  ok1: number;
  reciclo: number;
  quota: number;
  infra: number;
  ok1Pct: number | null;
  recicloPct: number | null;
  /** Linhas do terreno que caíram no default do run.sh (sem classificação). */
  ambiguos: number;
  /** Julgáveis com terreno provado no despacho — `julgaveis - ambiguos`. */
  classificados: number;
  /**
   * true quando algum degrau com amostra suficiente é balde ambíguo — o
   * terreno não emite sinal de trocar o default enquanto isso durar.
   */
  ambiguo: boolean;
  /** Degraus ambíguos do terreno, já com a contagem, p/ o aviso na tela. */
  degrausAmbiguos: { degrau: string; ambiguos: number; julgaveis: number }[];
  sinal: { tipo: SinalTipo; texto: string };
}

/** Um balde degrau (frente/modelo/effort) × terreno — mesma chave do ledger. */
export interface BaldeDegrau {
  degrau: string;
  terreno: string;
  n: number;
  julgaveis: number;
  ok1: number;
  quota: number;
  /** Despachos do balde cujo worker nunca rodou — fora do julgável. */
  infra: number;
  /** Linhas JULGÁVEIS do balde vindas do terreno DEFAULT do run.sh. */
  ambiguos: number;
  /** Amostra suficiente E mais de AMBIGUO_MAX de linhas não classificadas. */
  ambiguo: boolean;
}

/**
 * Agrega por degrau × terreno, exatamente como `cmdReport` em ledger.mjs: é
 * nesse recorte que a decisão de default é tomada, e é nele que a marca de
 * balde ambíguo vale. Denominador julgável exclui quota e infra (nenhum dos
 * dois julga qualidade); `ambiguos` conta só o que ENTRA nesse denominador —
 * contar quota/infra faria a razão passar de 1 e inflar a contaminação.
 */
export function baldesPorDegrau(entrada: LedgerLinha[]): BaldeDegrau[] {
  const linhas = semPendentes(entrada);
  const mapa = new Map<string, BaldeDegrau>();
  for (const r of linhas) {
    const degrau = `${r.frente}/${normModelo(r.modelo)}${r.effort ? `/${r.effort}` : ''}`;
    const chave = `${degrau} × ${r.terreno}`;
    let b = mapa.get(chave);
    if (!b) {
      b = {
        degrau,
        terreno: r.terreno,
        n: 0,
        julgaveis: 0,
        ok1: 0,
        quota: 0,
        infra: 0,
        ambiguos: 0,
        ambiguo: false,
      };
      mapa.set(chave, b);
    }
    b.n++;
    if (r.resultado === 'quota') b.quota++;
    else if (r.resultado === 'infra') b.infra++;
    else if (r.resultado === 'descartado') continue;
    else {
      b.julgaveis++;
      if (r.resultado === 'ok1') b.ok1++;
      if (terrenoAmbiguo(r)) b.ambiguos++;
    }
  }
  for (const b of mapa.values()) {
    b.ambiguo = b.julgaveis >= MIN_N && b.ambiguos / b.julgaveis > AMBIGUO_MAX;
  }
  return [...mapa.values()].sort((a, b) => b.n - a.n);
}

export interface ModeloRow {
  nome: string;
  frente: LedgerLinha['frente'];
  n: number;
  julg: number;
  ok1: number;
}

export type VereditoAssinatura = 'aumentar' | 'cancelar' | 'observar' | 'manter';

export interface AssinaturaCalc {
  nome: string;
  frente: string;
  valor: number;
  renova: string;
  papel: string;
  uso: number;
  /** Tarefas aceitas (ok1 + retrabalho) da frente — denominador do custo. */
  aceitas: number;
  quotas: number;
  /** Gasto proporcional à janela: valor * janelaDias / 30. */
  gasto: number;
  /** Custo por tarefa ACEITA da assinatura na janela (null se nada aceito). */
  custoSub: number | null;
  veredito: VereditoAssinatura;
}

/**
 * Custo médio por tarefa ACEITA do harness na janela (todas as assinaturas).
 * Denominador = ok1 + retrabalho: despacho barrado por quota, escalado ou
 * falho não entregou nada — dividir por ele maquiaria o custo pra baixo.
 */
export function custoMedioTarefa(
  linhas: LedgerLinha[],
  assinaturas: Assinatura[],
  janelaDias: number,
): number | null {
  const aceitas = semPendentes(linhas).filter(ehAceita).length;
  if (!aceitas) return null;
  const gastoTotal = assinaturas.reduce((s, a) => s + (a.valor * janelaDias) / 30, 0);
  return gastoTotal / aceitas;
}

/**
 * Recorta a janela rolante: ts em [agora-(desloc+1)*dias*864e5, agora-desloc*dias*864e5).
 * desloc=0 → período atual; desloc=1 → período anterior de mesmo tamanho.
 */
export function recorte(
  ledger: LedgerLinha[],
  janelaDias: number,
  desloc: number,
  agora: number = Date.now(),
): LedgerLinha[] {
  const ini = agora - (desloc + 1) * janelaDias * DIA_MS;
  const fim = agora - desloc * janelaDias * DIA_MS;
  return ledger.filter((r) => {
    const t = Date.parse(r.ts);
    return t >= ini && t < fim;
  });
}

/** KPIs gerais da janela — porta fiel de painel.mjs: kpisGerais. */
export function kpisGerais(entrada: LedgerLinha[]): KpisGerais {
  const linhas = semPendentes(entrada);
  const n = linhas.length;
  const julg = linhas.filter(ehJulgavel);
  const ok1 = julg.filter((r) => r.resultado === 'ok1').length;
  const off = linhas.filter((r) => r.frente !== 'claude' && r.frente !== 'cerebro').length;
  const rec = julg.filter((r) => r.resultado !== 'ok1').length;
  const quotaN = linhas.filter((r) => r.resultado === 'quota').length;
  const infraN = linhas.filter((r) => r.resultado === 'infra').length;
  const descartadoN = linhas.filter((r) => r.resultado === 'descartado').length;
  const durs = julg
    .map((r) => r.dur)
    .filter((d): d is number => typeof d === 'number' && d > 0)
    .sort((a, b) => a - b);
  const porFrente: Record<string, number> = {};
  for (const r of linhas) porFrente[r.frente] = (porFrente[r.frente] || 0) + 1;
  const quotaPorFrente: Record<string, number> = {};
  for (const r of linhas)
    if (r.resultado === 'quota') quotaPorFrente[r.frente] = (quotaPorFrente[r.frente] || 0) + 1;
  return {
    n,
    julg: julg.length,
    ok1N: ok1,
    recN: rec,
    offN: off,
    quotaN,
    infraN,
    descartadoN,
    aceitas: linhas.filter(ehAceita).length,
    ok1: julg.length ? ok1 / julg.length : null,
    offload: n ? off / n : null,
    quotaHit: n ? quotaN / n : null,
    reciclo: julg.length ? rec / julg.length : null,
    durMed: durs.length ? (durs[Math.floor(durs.length / 2)] ?? null) : null,
    // nearest-rank: com n<10 o p90 vira o maior valor — o n exibido avisa
    durP90: durs.length
      ? (durs[Math.min(durs.length - 1, Math.ceil(0.9 * durs.length) - 1)] ?? null)
      : null,
    durN: durs.length,
    porFrente,
    quotaPorFrente,
  };
}

/**
 * O publicador calcula os números decisórios uma vez e os carimba com versão.
 * O cálculo local continua como compatibilidade para snapshots v1 e detalhes.
 */
export function aplicarMetricasPublicadas(
  base: KpisGerais,
  publicadas: MetricasConstrucaoPublicadas | null | undefined,
): KpisGerais {
  if (!publicadas) return base;
  const n = Math.max(0, publicadas.total - publicadas.pendente);
  return {
    ...base,
    n,
    julg: publicadas.julgados,
    ok1N: publicadas.ok1,
    recN: publicadas.retrabalho,
    offN: publicadas.offload,
    quotaN: publicadas.quota,
    infraN: publicadas.infra,
    descartadoN: publicadas.descartado,
    aceitas: publicadas.aceitas,
    ok1: publicadas.qualidade,
    offload: publicadas.offload_pct,
    quotaHit: publicadas.quota_pct,
    reciclo: publicadas.retrabalho_pct,
    durMed: publicadas.duracao.p50_min,
    durP90: publicadas.duracao.p90_min,
    durN: publicadas.duracao.n,
    porFrente: publicadas.por_frente,
    quotaPorFrente: publicadas.quota_por_frente,
  };
}

const inteiroNaoNegativo = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isInteger(valor) && valor >= 0;
const numeroOuNull = (valor: unknown): valor is number | null =>
  valor === null || (typeof valor === 'number' && Number.isFinite(valor));
const proporcaoOuNull = (valor: unknown): valor is number | null =>
  valor === null ||
  (typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= 1);
const perto = (a: number | null, b: number | null): boolean =>
  a === b || (a != null && b != null && Math.abs(a - b) < 1e-9);

function construcaoPublicadaValida(c: MetricasConstrucaoPublicadas): boolean {
  if (!c || typeof c !== 'object' || !c.duracao || typeof c.duracao !== 'object') return false;
  const contagens = [
    c.total,
    c.julgados,
    c.ok1,
    c.retrabalho,
    c.aceitas,
    c.pendente,
    c.quota,
    c.infra,
    c.descartado,
    c.offload,
    c.duracao?.n,
  ];
  if (!contagens.every(inteiroNaoNegativo)) return false;
  if (c.total !== c.julgados + c.pendente + c.quota + c.infra + c.descartado) return false;
  if (c.julgados !== c.ok1 + c.retrabalho || c.aceitas > c.julgados) return false;
  if (c.offload > c.total - c.pendente || c.duracao.n > c.julgados) return false;
  if (!proporcaoOuNull(c.qualidade) || !proporcaoOuNull(c.retrabalho_pct)) return false;
  if (!proporcaoOuNull(c.offload_pct) || !proporcaoOuNull(c.quota_pct)) return false;
  if (!numeroOuNull(c.duracao.p50_min) || !numeroOuNull(c.duracao.p90_min)) return false;
  const qualidade = c.julgados ? c.ok1 / c.julgados : null;
  const retrabalho = c.julgados ? c.retrabalho / c.julgados : null;
  const ativos = c.total - c.pendente;
  const offload = ativos ? c.offload / ativos : null;
  const quota = ativos ? c.quota / ativos : null;
  return (
    perto(c.qualidade, qualidade) &&
    perto(c.retrabalho_pct, retrabalho) &&
    perto(c.offload_pct, offload) &&
    perto(c.quota_pct, quota)
  );
}

function revisaoPublicadaValida(
  r: NonNullable<HarnessBlob['metricas_periodos']>[string]['atual']['revisao'],
): boolean {
  if (!r || typeof r !== 'object') return false;
  if (![r.total, r.julgados, r.problemas_encontrados].every(inteiroNaoNegativo)) return false;
  if (r.julgados > r.total || r.problemas_encontrados > r.julgados) return false;
  if (!proporcaoOuNull(r.deteccao_pct)) return false;
  const deteccao = r.julgados ? r.problemas_encontrados / r.julgados : null;
  return perto(r.deteccao_pct, deteccao);
}

/** Valida versão, completude e coerência aritmética antes de liberar decisões na tela. */
export function contratoMetricasValido(dados: HarnessBlob): boolean {
  if (dados.schema_version !== HARNESS_SCHEMA_VERSION) return false;
  if (dados.metric_version !== HARNESS_METRIC_VERSION) return false;
  if (!dados.as_of || !Number.isFinite(Date.parse(dados.as_of))) return false;
  const saude = dados.saude_dados;
  if (
    !saude ||
    saude.schema_version !== HARNESS_SCHEMA_VERSION ||
    saude.metric_version !== HARNESS_METRIC_VERSION ||
    !inteiroNaoNegativo(saude.eventos_publicados) ||
    saude.eventos_publicados !== dados.ledger.length
  )
    return false;
  for (const dias of JANELAS_OBRIGATORIAS) {
    const periodo = dados.metricas_periodos?.[String(dias)];
    if (!periodo || periodo.dias !== dias || periodo.fim_atual !== dados.as_of) return false;
    if (!Number.isFinite(Date.parse(periodo.inicio_atual))) return false;
    for (const recortePublicado of [periodo.atual, periodo.anterior]) {
      if (!recortePublicado || typeof recortePublicado !== 'object') return false;
      if (!inteiroNaoNegativo(recortePublicado.eventos)) return false;
      if (!construcaoPublicadaValida(recortePublicado.construcao)) return false;
      if (!revisaoPublicadaValida(recortePublicado.revisao)) return false;
      if (
        recortePublicado.eventos <
        recortePublicado.construcao.total + recortePublicado.revisao.total
      )
        return false;
    }
  }
  return true;
}

export function filtrarHistoricoCompativel(history: KpiHistoricoLinha[]): KpiHistoricoLinha[] {
  return history.filter(
    (linha) =>
      linha.schema_version === HARNESS_SCHEMA_VERSION &&
      linha.metric_version === HARNESS_METRIC_VERSION,
  );
}

export interface KpisRevisao {
  total: number;
  julg: number;
  problemasN: number;
  deteccao: number | null;
  ic95: { min: number; max: number } | null;
}

function intervaloWilson(sucessos: number, total: number): { min: number; max: number } | null {
  if (!total) return null;
  const z = 1.959963984540054;
  const p = sucessos / total;
  const z2 = z * z;
  const centro = (p + z2 / (2 * total)) / (1 + z2 / total);
  const margem = (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / (1 + z2 / total);
  return {
    min: Math.max(0, centro - margem),
    max: Math.min(1, centro + margem),
  };
}

/**
 * Mede o resultado das revisões sem misturá-lo à qualidade de construção.
 * `retrabalho` em uma revisão significa que ela encontrou algo a corrigir.
 */
export function kpisRevisao(entrada: LedgerLinha[]): KpisRevisao {
  const linhas = soRevisoesExplicitas(entrada);
  const julg = linhas.filter(ehJulgavel);
  const problemasN = julg.filter((r) => r.resultado === 'retrabalho').length;
  return {
    total: linhas.length,
    julg: julg.length,
    problemasN,
    deteccao: julg.length ? problemasN / julg.length : null,
    ic95: intervaloWilson(problemasN, julg.length),
  };
}

/** KPIs por terreno + sinal automático — porta fiel de painel.mjs: kpisTerreno. */
export function kpisTerreno(
  entrada: LedgerLinha[],
  cadeias: Record<string, CadeiaTerreno>,
): Record<string, TerrenoKpi> {
  const linhas = semPendentes(entrada);
  const por: Record<string, TerrenoKpi> = {};
  const vazio = (): TerrenoKpi => ({
    n: 0,
    julgaveis: 0,
    ok1: 0,
    reciclo: 0,
    quota: 0,
    infra: 0,
    ok1Pct: null,
    recicloPct: null,
    ambiguos: 0,
    classificados: 0,
    ambiguo: false,
    degrausAmbiguos: [],
    sinal: { tipo: 'vazio', texto: 'sem dados — nenhum despacho neste terreno no período' },
  });
  for (const t of Object.keys(cadeias)) por[t] = vazio();
  for (const r of linhas) {
    if (!por[r.terreno]) por[r.terreno] = vazio();
    const t = por[r.terreno] as TerrenoKpi;
    t.n++;
    if (r.resultado === 'quota') t.quota++;
    else if (r.resultado === 'infra') t.infra++;
    else if (r.resultado === 'descartado') continue;
    else {
      t.julgaveis++;
      if (r.resultado === 'ok1') t.ok1++;
      else t.reciclo++;
      if (terrenoAmbiguo(r)) t.ambiguos++;
    }
  }
  // Contaminação se mede no MESMO recorte em que a decisão de default é
  // tomada — degrau × terreno (ledger.mjs). Somar o terreno inteiro diluiria
  // um degrau contaminado nas linhas limpas dos outros e deixaria passar o
  // sinal que o ledger já suprime.
  for (const b of baldesPorDegrau(linhas)) {
    if (!b.ambiguo) continue;
    const t = por[b.terreno];
    if (!t) continue;
    t.ambiguo = true;
    t.degrausAmbiguos.push({ degrau: b.degrau, ambiguos: b.ambiguos, julgaveis: b.julgaveis });
  }
  for (const [nome, t] of Object.entries(por)) {
    t.ok1Pct = t.julgaveis ? t.ok1 / t.julgaveis : null;
    t.recicloPct = t.julgaveis ? t.reciclo / t.julgaveis : null;
    t.classificados = t.julgaveis - t.ambiguos;
    const cad = cadeias[nome];
    // Três estados distintos de "não há 🔺/🔻", e a tela precisa dizer QUAL:
    // sem nenhum registro (instrumento sem entrada) · registro de menos para
    // medir · registro suficiente mas sem terreno provado no despacho.
    if (t.n === 0)
      t.sinal = { tipo: 'vazio', texto: 'sem dados — nenhum despacho neste terreno no período' };
    else if (t.julgaveis < MIN_N)
      t.sinal = {
        tipo: 'dados',
        texto:
          `sem sinal — só ${t.julgaveis} tarefa(s) medível(is) no período, precisa de ${MIN_N} ` +
          `(${t.classificados}/${t.julgaveis} com o terreno declarado no despacho)`,
      };
    else if (t.ambiguo)
      t.sinal = {
        tipo: 'ambiguo',
        texto: `sem sinal — só ${t.classificados}/${t.julgaveis} tarefas entraram com o terreno declarado no despacho, então o ok de 1ª mede o registro e não o modelo`,
      };
    else if (t.ok1Pct != null && t.ok1Pct < OK1_PISO) {
      // Abaixo do piso: normalmente "subir o modelo". Mas se o modelo já está
      // no teto (piso===teto do terreno, ex.: SQL/dinheiro em Opus 5), NÃO há
      // modelo pra cima — a alavanca vira o ESFORÇO (high→max) e, esgotado
      // esse, reforçar a revisão. Espelha o split de painel.mjs.
      const amostra = `${t.ok1}/${t.julgaveis}`;
      const pct = Math.round(t.ok1Pct * 100);
      if (cad?.modelo_no_teto) {
        if (cad.effort && cad.effort_teto && cad.effort !== cad.effort_teto)
          t.sinal = {
            tipo: 'esforco',
            texto: `subir o esforço (${cad.effort} → ${cad.effort_teto}) — modelo travado no topo · ok1 ${pct}% (${amostra}) < 70%`,
          };
        else
          t.sinal = {
            tipo: 'esforco',
            texto: `reforçar a revisão — modelo e esforço no teto · ok1 ${pct}% (${amostra}) < 70%`,
          };
      } else {
        t.sinal = {
          tipo: 'subir',
          texto: `subir o modelo — ok1 ${pct}% (${amostra}) < 70%`,
        };
      }
    } else if (t.ok1Pct != null && t.ok1Pct >= OK1_TETO && t.julgaveis >= MIN_N && !cad?.piso)
      t.sinal = {
        tipo: 'baratear',
        texto: `dá pra testar modelo mais barato — ok1 ${Math.round(t.ok1Pct * 100)}% (${t.ok1}/${t.julgaveis})`,
      };
    else t.sinal = { tipo: 'ok', texto: 'manter — sustentado pelos dados' };
    if (t.quota >= QUOTA_ALERTA)
      t.sinal = {
        tipo: 'quota',
        texto: `frente saturada — bateu quota ${t.quota}× na janela`,
      };
  }
  return por;
}

// Espelho de ~/.claude/orquestracao/modelos.mjs (fonte canônica dos nomes).
// O publicar-painel.mjs normaliza antes do upsert, mas blobs ANTIGOS do
// harness_snapshot chegam crus — por isso a tela normaliza de novo na leitura.
const CANON_MODELO: [RegExp, string][] = [
  // "opus" seco é sempre Opus 4.8 (registros anteriores a 2026-08-04)
  [/^(claude-)?opus([-_.]?4[-_.]?8)?$/i, 'opus-4.8'],
  [/^(claude-)?opus[-_.]?5$/i, 'opus-5'],
  [/^(kimi-code\/)?k3(-256k)?$/i, 'k3-256k'],
  [/^(claude-)?fable(-5)?$/i, 'fable'],
  [/^(claude-)?sonnet(-5)?$/i, 'sonnet'],
  [/^(claude-)?haiku(-4[-_.]?5)?$/i, 'haiku'],
];

/** Normaliza nomes variantes do mesmo modelo (logados diferente ao longo do tempo). */
export function normModelo(modelo: string): string {
  const s = String(modelo ?? '').trim();
  for (const [re, canon] of CANON_MODELO) if (re.test(s)) return canon;
  return s; // gpt-5.6-sol/terra/luna e desconhecidos passam intactos
}

/** Chamadas por modelo+effort — porta fiel de painel.mjs: porModelo (30d). */
export function porModelo(entrada: LedgerLinha[]): ModeloRow[] {
  const linhas = semPendentes(entrada);
  const mapa = new Map<string, ModeloRow>();
  for (const r of linhas) {
    const nome = `${normModelo(r.modelo)}${r.effort ? ` · ${r.effort}` : ''}`;
    let m = mapa.get(nome);
    if (!m) {
      m = { nome, frente: r.frente, n: 0, julg: 0, ok1: 0 };
      mapa.set(nome, m);
    }
    m.n++;
    if (ehJulgavel(r)) {
      m.julg++;
      if (r.resultado === 'ok1') m.ok1++;
    }
  }
  return [...mapa.values()].sort((a, b) => b.n - a.n);
}

/**
 * Custo por assinatura na janela + veredito de renovação.
 * Porta fiel de painel.mjs (bloco Assinaturas), parametrizada por janelaDias.
 */
export function custoAssinaturas(
  entrada: LedgerLinha[],
  assinaturas: Assinatura[],
  janelaDias: number,
): AssinaturaCalc[] {
  const linhas = semPendentes(entrada);
  const g = kpisGerais(linhas);
  const custoMedio = custoMedioTarefa(linhas, assinaturas, janelaDias);
  return assinaturas.map((a) => {
    const uso = g.porFrente[a.frente] || 0;
    const aceitas = linhas.filter((r) => r.frente === a.frente && ehAceita(r)).length;
    const quotas = g.quotaPorFrente[a.frente] || 0;
    const gasto = (a.valor * janelaDias) / 30;
    const custoSub = aceitas ? gasto / aceitas : null;
    // Veredito de renovação: saturada (quer mais) > sem uso (cancelar) >
    // cara por uso > rende bem. Usa o custo médio do harness como régua.
    let veredito: VereditoAssinatura;
    if (quotas > 0) veredito = 'aumentar';
    else if (uso === 0) veredito = 'cancelar';
    else if (custoMedio != null && custoSub != null && custoSub > 1.6 * custoMedio)
      veredito = 'observar';
    else veredito = 'manter';
    return { ...a, uso, aceitas, quotas, gasto, custoSub, veredito };
  });
}

export const PESO_VALOR = { q: 0.7, c: 0.2, r: 0.1 } as const;
export const CUSTO_META = 2.5;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export function valorScore(q: number, c: number, r: number): number {
  const qualidade = clamp01(q);
  const custo = clamp01(c);
  const confiabilidade = clamp01(r);
  const custoEfetivo = qualidade < 0.5 ? Math.min(custo, qualidade) : custo;
  return Math.round(
    100 * (PESO_VALOR.q * qualidade + PESO_VALOR.c * custoEfetivo + PESO_VALOR.r * confiabilidade),
  );
}

export interface FrenteValor {
  frente: string;
  n: number;
  julg: number;
  q: number | null;
  custoTarefa: number | null;
  valor: number | null;
}

/** Placar de valor por frente, limitado às assinaturas do harness. */
export function placarPorFrente(
  entrada: LedgerLinha[],
  assinaturas: Assinatura[],
  janelaDias: number,
): FrenteValor[] {
  const linhas = semPendentes(entrada);
  const frentes = [...new Set(assinaturas.map((a) => a.frente))].filter(
    (frente) => frente === 'codex' || frente === 'kimi' || frente === 'claude',
  );
  const custoGeral = custoMedioTarefa(linhas, assinaturas, janelaDias);

  return frentes
    .map((frente): FrenteValor => {
      const daFrente = linhas.filter((linha) => linha.frente === frente);
      const julgaveis = daFrente.filter(ehJulgavel);
      const ok1 = julgaveis.filter((linha) => linha.resultado === 'ok1').length;
      const q = julgaveis.length ? ok1 / julgaveis.length : null;
      const uso = daFrente.length;
      const aceitas = daFrente.filter(ehAceita).length;
      const quotas = daFrente.filter((linha) => linha.resultado === 'quota').length;
      const gasto = assinaturas
        .filter((assinatura) => assinatura.frente === frente)
        .reduce((total, assinatura) => total + (assinatura.valor * janelaDias) / 30, 0);
      const custoTarefa = aceitas ? gasto / aceitas : null;
      const c = custoGeral != null && custoTarefa != null ? clamp01(custoGeral / custoTarefa) : 0;
      const r = uso ? 1 - quotas / uso : 1;
      return {
        frente,
        n: uso,
        julg: julgaveis.length,
        q,
        custoTarefa,
        valor: q == null || julgaveis.length < MIN_AMOSTRA_GERAL ? null : valorScore(q, c, r),
      };
    })
    .sort((a, b) => {
      if (a.valor == null && b.valor == null) return 0;
      if (a.valor == null) return 1;
      if (b.valor == null) return -1;
      return b.valor - a.valor;
    });
}

// ── Autonomia ────────────────────────────────────────────────────────────────
// Espelha o §AUTONOMIA — 3 NÍVEIS do CLAUDE.md do SeuCamarão. Mede quanto o
// dono foi interrompido e o quanto a interrupção valeu. Coletor:
// ~/.claude/orquestracao/autonomia.mjs.

/** Aceite acima disso = o assistente pergunta o óbvio; pode decidir mais. */
const ACEITE_TETO = 0.8;
/** Decisões carimbadas desfeitas acima disso = está decidindo demais. */
const DESFEITAS_TETO = 0.15;

export interface AutonomiaKpi {
  perguntas: number;
  /** Média de perguntas por dia COM pergunta (dia mudo não dilui a conta). */
  perguntasPorDia: number | null;
  aceitouN: number;
  corrigiuN: number;
  ignorouN: number;
  aceitePct: number | null;
  correcoesPct: number | null;
  ignorouPct: number | null;
  esperasLongas: number;
  /** Mediana das medianas diárias de espera, em minutos. */
  esperaMedianaMin: number | null;
  n2Carimbadas: number;
  n2Desfeitas: number;
  n2DesfeitasPct: number | null;
  veredito: { tipo: 'perguntando-demais' | 'decidindo-demais' | 'ok'; texto: string };
}

const AUTONOMIA_VAZIA: AutonomiaKpi = {
  perguntas: 0,
  perguntasPorDia: null,
  aceitouN: 0,
  corrigiuN: 0,
  ignorouN: 0,
  aceitePct: null,
  correcoesPct: null,
  ignorouPct: null,
  esperasLongas: 0,
  esperaMedianaMin: null,
  n2Carimbadas: 0,
  n2Desfeitas: 0,
  n2DesfeitasPct: null,
  veredito: { tipo: 'ok', texto: 'coletando dados' },
};

const mediana = (xs: number[]): number | null =>
  xs.length === 0 ? null : ([...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? null);

/**
 * Agregado da janela. Mesma convenção de `recorte`: os últimos `janelaDias`
 * contados de `agora` para trás — só que a série de autonomia é diária
 * (`data` = 'YYYY-MM-DD'), então o corte é por data, não por timestamp.
 */
export function kpisAutonomia(
  autonomia: AutonomiaBlob | null | undefined,
  janelaDias: number,
  agora: number = Date.now(),
): AutonomiaKpi {
  if (!autonomia) return AUTONOMIA_VAZIA;

  const ini = agora - janelaDias * DIA_MS;
  const dentro = (d: AutonomiaDia): boolean => {
    const t = Date.parse(`${d.data}T12:00:00Z`);
    return Number.isFinite(t) && t >= ini && t < agora + DIA_MS;
  };
  const dias = (autonomia.perguntas_por_dia ?? []).filter(dentro);

  const soma = (campo: keyof AutonomiaDia): number =>
    dias.reduce((s, d) => s + ((d[campo] as number) ?? 0), 0);

  const perguntas = soma('perguntas');
  const aceitouN = soma('aceitou');
  const corrigiuN = soma('corrigiu');
  const ignorouN = soma('ignorou');
  const pct = (n: number): number | null => (perguntas ? n / perguntas : null);

  // N2 vem indexado por data; recorta pela mesma janela.
  let n2Carimbadas = 0;
  let n2Desfeitas = 0;
  for (const [data, v] of Object.entries(autonomia.n2?.por_dia ?? {})) {
    const t = Date.parse(`${data}T12:00:00Z`);
    if (!Number.isFinite(t) || t < ini || t >= agora + DIA_MS) continue;
    n2Carimbadas += v.carimbadas ?? 0;
    n2Desfeitas += v.desfeitas ?? 0;
  }
  const n2DesfeitasPct = n2Carimbadas ? n2Desfeitas / n2Carimbadas : null;

  const aceitePct = pct(aceitouN);
  let veredito = AUTONOMIA_VAZIA.veredito;
  if (n2DesfeitasPct != null && n2DesfeitasPct > DESFEITAS_TETO)
    veredito = {
      tipo: 'decidindo-demais',
      texto: 'Estou decidindo demais — vou voltar a perguntar mais',
    };
  else if (aceitePct != null && aceitePct >= ACEITE_TETO)
    veredito = {
      tipo: 'perguntando-demais',
      texto: 'Estou perguntando demais — posso decidir mais sozinho',
    };
  else if (perguntas > 0) veredito = { tipo: 'ok', texto: 'Calibragem está boa' };

  return {
    perguntas,
    perguntasPorDia: dias.length ? Math.round((perguntas / dias.length) * 10) / 10 : null,
    aceitouN,
    corrigiuN,
    ignorouN,
    aceitePct,
    correcoesPct: pct(corrigiuN),
    ignorouPct: pct(ignorouN),
    esperasLongas: soma('esperas_longas'),
    esperaMedianaMin: mediana(
      dias.map((d) => d.espera_mediana_min).filter((x): x is number => x != null),
    ),
    n2Carimbadas,
    n2Desfeitas,
    n2DesfeitasPct,
    veredito,
  };
}

/** Placar de valor geral do harness. */
export function valorGeral(
  linhas: LedgerLinha[],
  assinaturas: Assinatura[],
  janelaDias: number,
): number | null {
  const geral = kpisGerais(linhas);
  if (geral.ok1 == null || geral.julg < MIN_AMOSTRA_GERAL) return null;
  const custo = custoMedioTarefa(linhas, assinaturas, janelaDias);
  const c = custo == null ? 0 : clamp01(CUSTO_META / custo);
  const r = 1 - (geral.quotaHit ?? 0);
  return valorScore(geral.ok1, c, r);
}
