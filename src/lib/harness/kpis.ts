// Porta pura e testada da lógica de KPIs do Painel do Harness.
// Fonte: ~/.claude/orquestracao/ledger.mjs (calcKpis) e painel.mjs
// (kpisGerais / kpisTerreno / porModelo / assinaturas). Qualquer mudança na
// governança (limiares do CLAUDE.md global) precisa ser espelhada aqui.

import type { Assinatura, CadeiaTerreno, LedgerLinha } from '@/types/harness';

const DIA_MS = 864e5;

// Limiares (espelho da governança do harness)
const MIN_N = 5; // amostra mínima p/ sinal
const OK1_PISO = 0.7; // abaixo → degrau subdimensionado
const OK1_TETO = 0.9; // acima (n>=8, degrau não-mínimo) → candidato a descer
const QUOTA_ALERTA = 3; // eventos de quota na janela → frente saturada

export interface KpisGerais {
  n: number;
  ok1: number | null;
  offload: number | null;
  quotaHit: number | null;
  reciclo: number | null;
  durMed: number | null;
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
  quotas: number;
  /** Gasto proporcional à janela: valor * janelaDias / 30. */
  gasto: number;
  /** Custo por tarefa da assinatura na janela (null se sem uso). */
  custoSub: number | null;
  veredito: VereditoAssinatura;
}

/** Custo médio por tarefa do harness na janela (todas as assinaturas). */
export function custoMedioTarefa(
  linhas: LedgerLinha[],
  assinaturas: Assinatura[],
  janelaDias: number,
): number | null {
  const n = linhas.length;
  if (!n) return null;
  const gastoTotal = assinaturas.reduce((s, a) => s + (a.valor * janelaDias) / 30, 0);
  return gastoTotal / n;
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
export function kpisGerais(linhas: LedgerLinha[]): KpisGerais {
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
    ok1: julg.length ? ok1 / julg.length : null,
    offload: n ? off / n : null,
    quotaHit: n ? (n - julg.length) / n : null,
    reciclo: julg.length ? rec / julg.length : null,
    durMed: durs.length ? durs[Math.floor(durs.length / 2)] : null,
    durN: durs.length,
    porFrente,
    quotaPorFrente,
  };
}

/** KPIs por terreno + sinal automático — porta fiel de painel.mjs: kpisTerreno. */
export function kpisTerreno(
  linhas: LedgerLinha[],
  cadeias: Record<string, CadeiaTerreno>,
): Record<string, TerrenoKpi> {
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
    const t = por[r.terreno] || (por[r.terreno] = vazio());
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
    if (t.julgaveis < MIN_N) t.sinal = { tipo: 'dados', texto: `coletando dados (n=${t.julgaveis})` };
    else if (t.ok1Pct != null && t.ok1Pct < OK1_PISO)
      t.sinal = {
        tipo: 'subir',
        texto: `subir o modelo — ok1 ${Math.round(t.ok1Pct * 100)}% < 70%`,
      };
    else if (t.ok1Pct != null && t.ok1Pct >= OK1_TETO && t.julgaveis >= 8 && !cad?.piso)
      t.sinal = {
        tipo: 'baratear',
        texto: `dá pra testar modelo mais barato — ok1 ${Math.round(t.ok1Pct * 100)}%`,
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

/** Normaliza nomes variantes do mesmo modelo (logados diferente ao longo do tempo). */
export function normModelo(modelo: string): string {
  let s = String(modelo).replace(/^kimi-code\//, ''); // kimi-code/k3-256k → k3-256k
  if (s === 'claude-opus-4-8') s = 'opus-4.8'; // apelidos do Opus 4.8
  return s;
}

/** Chamadas por modelo+effort — porta fiel de painel.mjs: porModelo (30d). */
export function porModelo(linhas: LedgerLinha[]): ModeloRow[] {
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
  linhas: LedgerLinha[],
  assinaturas: Assinatura[],
  janelaDias: number,
): AssinaturaCalc[] {
  const g = kpisGerais(linhas);
  const custoMedio = custoMedioTarefa(linhas, assinaturas, janelaDias);
  return assinaturas.map((a) => {
    const uso = g.porFrente[a.frente] || 0;
    const quotas = g.quotaPorFrente[a.frente] || 0;
    const gasto = (a.valor * janelaDias) / 30;
    const custoSub = uso ? gasto / uso : null;
    // Veredito de renovação: saturada (quer mais) > sem uso (cancelar) >
    // cara por uso > rende bem. Usa o custo médio do harness como régua.
    let veredito: VereditoAssinatura;
    if (quotas > 0) veredito = 'aumentar';
    else if (uso === 0) veredito = 'cancelar';
    else if (custoMedio != null && custoSub != null && custoSub > 1.6 * custoMedio)
      veredito = 'observar';
    else veredito = 'manter';
    return { ...a, uso, quotas, gasto, custoSub, veredito };
  });
}
