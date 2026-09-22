/** Formatação pt-BR da página /harness v2. Ausente (null/NaN) vira "—", nunca 0. */

const TRACO = '—';

function valido(x: number | null | undefined): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/** Inteiro com separador de milhar: 1843200 → "1.843.200". */
export function fmtInt(x: number | null | undefined): string {
  return valido(x) ? Math.round(x).toLocaleString('pt-BR') : TRACO;
}

/** Percentual 0–100 com 1 casa: 72.44 → "72,4%". */
export function fmtPct(x: number | null | undefined): string {
  return valido(x)
    ? `${x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : TRACO;
}

/** Nota 0–100 sem casa: 72.4 → "72". */
export function fmtNota(x: number | null | undefined): string {
  return valido(x) ? String(Math.round(x)) : TRACO;
}

/** Tokens: 9870 → "9,9 mil"; 2917450 → "2,9 mi"; abaixo de mil, inteiro. */
export function fmtTokens(x: number | null | undefined): string {
  if (!valido(x)) return TRACO;
  const um = { maximumFractionDigits: 1 };
  if (x >= 1e6) return `${(x / 1e6).toLocaleString('pt-BR', um)} mi`;
  if (x >= 1e3) return `${(x / 1e3).toLocaleString('pt-BR', um)} mil`;
  return fmtInt(x);
}

/** Duração em segundos: 45 → "45 s"; 538.2 → "9 min"; 5400 → "1,5 h". */
export function fmtDuracao(seg: number | null | undefined): string {
  if (!valido(seg) || seg < 0) return TRACO;
  if (seg < 90) return `${Math.round(seg)} s`;
  if (seg < 90 * 60) return `${Math.round(seg / 60)} min`;
  return `${(seg / 3600).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
}

/** Dólares por tarefa: 0.08 → "US$ 0,08". */
export function fmtUsd(x: number | null | undefined): string {
  return valido(x)
    ? `US$ ${x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : TRACO;
}

/** Data ISO em dd/mm HH:mm no fuso de São Paulo. */
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return TRACO;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return TRACO;
  return new Date(t).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
