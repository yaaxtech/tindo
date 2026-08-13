// Lógica derivada do bloco "Janela" do painel do Harness — consumo de
// contexto das sessões do Claude e gestos de higiene (subagente, chip,
// compactar). Tudo que é regra de apresentação (estado do bloco, formatação
// pt-BR, regra das 6 horas) vive aqui e é testado em janela.test.ts; o
// componente Janela.tsx só pinta.

import type { JanelaBlob, JanelaCampo, JanelaKpis } from '@/types/harness';

/** Dado com mais de 6h vira "velho": mostra aviso em cima, nunca some calado. */
export const JANELA_LIMIAR_MS = 6 * 3600e3;

const numeroBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const mediaBR = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const pctBR = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const horaBR = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Inteiro em pt-BR (ponto de milhar): 1074 → "1.074". */
export const formatarNumero = (n: number): string => numeroBR.format(n);

/** Fração → percentual pt-BR com no máximo 1 casa: 0.069 → "6,9%", 0.96 → "96%". */
export const formatarPct = (x: number | null): string => (x == null ? '—' : pctBR.format(x));

/** Média curta em pt-BR (vírgula decimal): 0.21 → "0,21". */
export const formatarMedia = (x: number | null): string => (x == null ? '—' : mediaBR.format(x));

/**
 * Tokens em forma curta: 18700000000 → "18,7 bi" · 161000000 → "161 M" ·
 * 12345 → "12 mil" · 950 → "950".
 */
export function formatarTokens(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n < 0) return '—';
  if (n >= 1e9) return `${mediaBR.format(n / 1e9)} bi`;
  if (n >= 1e6) return `${numeroBR.format(Math.round(n / 1e6))} M`;
  if (n >= 1e3) return `${numeroBR.format(Math.round(n / 1e3))} mil`;
  return numeroBR.format(n);
}

/** Hora local da coleta, para o aviso de dado velho: "21:00". */
export function formatarHoraColeta(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? horaBR.format(new Date(t)) : '—';
}

/**
 * Tile "Sessões acima do teto": "74 de 1.074 (6,9%)" — percentual nunca
 * aparece sem a amostra n/N junto (regra da casa).
 */
export function formatarAcimaTeto(
  acima: JanelaKpis['sessoes_acima_teto'],
  sessoes: number,
): string {
  if (!acima) return '—';
  return `${formatarNumero(acima.n)} de ${formatarNumero(sessoes)} (${formatarPct(acima.pct)})`;
}

export type EstadoJanela =
  /** Campo ausente ou null — a coleta nunca rodou (ou ainda não chegou). */
  | { tipo: 'ausente' }
  /** A coleta rodou e falhou na máquina local. */
  | { tipo: 'erro'; mensagem: string; geradoEm: string }
  /** Blob válido. `velho` = gerado_em há mais de 6h — números sobem COM aviso. */
  | { tipo: 'ok'; blob: JanelaBlob; velho: boolean; geradoEm: string };

/** Decide o que o bloco mostra. `agora` injetável para teste. */
export function estadoJanela(campo: JanelaCampo | undefined, agora = Date.now()): EstadoJanela {
  if (!campo) return { tipo: 'ausente' };
  if ('erro' in campo) return { tipo: 'erro', mensagem: campo.erro, geradoEm: campo.gerado_em };
  const t = Date.parse(campo.gerado_em);
  const velho = !Number.isFinite(t) || agora - t > JANELA_LIMIAR_MS;
  return { tipo: 'ok', blob: campo, velho, geradoEm: campo.gerado_em };
}
