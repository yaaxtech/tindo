// Carimbo de atualização do cabeçalho do Painel do Harness:
// "atualizado em 16/08 às 11:20 · há 30 min". Lib PURA: `agora` sempre
// injetado, zero I/O — o cabeçalho só pinta o que sai daqui.

const MIN_MS = 60e3;
const HORA_MS = 3600e3;
const DIA_MS = 864e5;

const dataBR = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const horaBR = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Distância em linguagem leiga entre o snapshot e agora: "há 30 min".
 * Carimbo à frente do relógio (fuso/skew da máquina que empurrou) cai em
 * "agora mesmo" — nunca mostramos "há -3 min".
 */
export function tempoRelativo(iso: string, agora: number): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const delta = agora - t;
  if (delta < MIN_MS) return 'agora mesmo';
  if (delta < HORA_MS) return `há ${Math.floor(delta / MIN_MS)} min`;
  if (delta < DIA_MS) {
    const h = Math.floor(delta / HORA_MS);
    return `há ${h} ${h === 1 ? 'hora' : 'horas'}`;
  }
  const d = Math.floor(delta / DIA_MS);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

/**
 * Linha do cabeçalho. A data anda junto da hora porque o painel fica aberto
 * por dias: só "11:20" parecia fresco mesmo quando era de ontem.
 * `null` = carimbo ilegível → o cabeçalho omite o trecho inteiro.
 */
export function carimboAtualizacao(iso: string, agora: number): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return `atualizado em ${dataBR.format(d)} às ${horaBR.format(d)} · ${tempoRelativo(iso, agora)}`;
}
