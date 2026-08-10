// Porta pura e testada da lógica de KPIs do Painel do Harness.
// Fonte: ~/.claude/orquestracao/ledger.mjs (calcKpis) e painel.mjs
// (kpisGerais / kpisTerreno / porModelo / assinaturas). Qualquer mudança na
// governança (limiares do CLAUDE.md global) precisa ser espelhada aqui.

import type { Assinatura, CadeiaTerreno, LedgerLinha } from '@/types/harness';

const DIA_MS = 864e5;

// "pendente" = provisório dos run.sh sem revisão do cérebro — nunca entra em
// KPI nenhum (contaria como retrabalho e quebraria qualidade/retrabalho).
// Filtrado na ENTRADA de cada função de KPI: blobs antigos (sem pendente)
// passam intactos e blobs novos ficam corretos sem depender do caller.
const semPendentes = (linhas: LedgerLinha[]): LedgerLinha[] =>
  linhas.filter((r) => r.resultado !== 'pendente');

/** Despachos provisórios (run.sh) aguardando revisão — só para a contagem ⏳. */
export const contarPendentes = (linhas: LedgerLinha[]): number =>
  linhas.filter((r) => r.resultado === 'pendente').length;

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
const MIN_N = 5; // amostra mínima p/ sinal
const OK1_PISO = 0.7; // abaixo → degrau subdimensionado
const OK1_TETO = 0.9; // acima (n>=8, degrau não-mínimo) → candidato a descer
const QUOTA_ALERTA = 3; // eventos de quota na janela → frente saturada

export interface KpisGerais {
  n: number;
  /** Julgáveis (n − quota): denominador de qualidade/retrabalho. */
  julg: number;
  /** Contagens cruas — para mostrar a amostra "x/y" ao lado de cada %. */
  ok1N: number;
  recN: number;
  offN: number;
  quotaN: number;
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

export type SinalTipo = 'dados' | 'subir' | 'baratear' | 'ok' | 'quota';

export interface TerrenoKpi {
  n: number;
  julgaveis: number;
  ok1: number;
  reciclo: number;
  quota: number;
  ok1Pct: number | null;
  recicloPct: number | null;
  sinal: { tipo: SinalTipo; texto: string };
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
  const julg = linhas.filter((r) => r.resultado !== 'quota');
  const ok1 = julg.filter((r) => r.resultado === 'ok1').length;
  const off = linhas.filter((r) => r.frente !== 'claude' && r.frente !== 'cerebro').length;
  const rec = julg.filter((r) => r.resultado !== 'ok1').length;
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
    quotaN: n - julg.length,
    aceitas: linhas.filter(ehAceita).length,
    ok1: julg.length ? ok1 / julg.length : null,
    offload: n ? off / n : null,
    quotaHit: n ? (n - julg.length) / n : null,
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
    ok1Pct: null,
    recicloPct: null,
    sinal: { tipo: 'dados', texto: 'coletando dados (n=0)' },
  });
  for (const t of Object.keys(cadeias)) por[t] = vazio();
  for (const r of linhas) {
    if (!por[r.terreno]) por[r.terreno] = vazio();
    const t = por[r.terreno] as TerrenoKpi;
    t.n++;
    if (r.resultado === 'quota') t.quota++;
    else {
      t.julgaveis++;
      if (r.resultado === 'ok1') t.ok1++;
      else t.reciclo++;
    }
  }
  for (const [nome, t] of Object.entries(por)) {
    t.ok1Pct = t.julgaveis ? t.ok1 / t.julgaveis : null;
    t.recicloPct = t.julgaveis ? t.reciclo / t.julgaveis : null;
    const cad = cadeias[nome];
    if (t.julgaveis < MIN_N)
      t.sinal = { tipo: 'dados', texto: `coletando dados (n=${t.julgaveis})` };
    else if (t.ok1Pct != null && t.ok1Pct < OK1_PISO)
      t.sinal = {
        tipo: 'subir',
        texto: `subir o modelo — ok1 ${Math.round(t.ok1Pct * 100)}% (${t.ok1}/${t.julgaveis}) < 70%`,
      };
    else if (t.ok1Pct != null && t.ok1Pct >= OK1_TETO && t.julgaveis >= 8 && !cad?.piso)
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
    if (r.resultado !== 'quota') {
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
      const julgaveis = daFrente.filter((linha) => linha.resultado !== 'quota');
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
        q,
        custoTarefa,
        valor: q == null ? null : valorScore(q, c, r),
      };
    })
    .sort((a, b) => {
      if (a.valor == null && b.valor == null) return 0;
      if (a.valor == null) return 1;
      if (b.valor == null) return -1;
      return b.valor - a.valor;
    });
}

/** Placar de valor geral do harness. */
export function valorGeral(
  linhas: LedgerLinha[],
  assinaturas: Assinatura[],
  janelaDias: number,
): number | null {
  const geral = kpisGerais(linhas);
  if (geral.ok1 == null) return null;
  const custo = custoMedioTarefa(linhas, assinaturas, janelaDias);
  const c = custo == null ? 0 : clamp01(CUSTO_META / custo);
  const r = 1 - (geral.quotaHit ?? 0);
  return valorScore(geral.ok1, c, r);
}
