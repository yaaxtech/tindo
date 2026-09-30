/**
 * Adiamento por etiqueta no Todoist (Novo TinDo, fase 3).
 *
 * O dono marca um lembrete com `@tarde`, `@noite`, `@amanha` ou `@adiar` no
 * Todoist; o TinDo calcula o novo horário, reagenda e tira a etiqueta.
 * Este módulo é PURO: só decide o destino. Quem escreve no Todoist é o service.
 */

export type EtiquetaAdiamento = 'tarde' | 'noite' | 'amanha' | 'adiar';

export const ETIQUETAS_ADIAMENTO: readonly EtiquetaAdiamento[] = [
  'tarde',
  'noite',
  'amanha',
  'adiar',
];

/** Start hour of each shift, in the user's local time. */
export interface HorariosTurno {
  manha: number;
  tarde: number;
  noite: number;
}

export const HORARIOS_PADRAO: HorariosTurno = { manha: 9, tarde: 14, noite: 19 };

/** Default user timezone (Todoist profile of the owner). */
export const FUSO_PADRAO = 'America/Fortaleza';

/** Default days for `@adiar` on low-priority items when there is no history. */
const DIAS_PADRAO_ADIAR = 2;
const DIAS_MAX_ADIAR = 7;

export interface EntradaAdiamento {
  etiqueta: EtiquetaAdiamento;
  agora: Date;
  /** Prioridade da API do Todoist: 4 = p1 (urgente) … 1 = p4 (normal). */
  prioridadeApi: 1 | 2 | 3 | 4;
  /** Prazo (deadline) do Todoist, 'YYYY-MM-DD', se houver. */
  prazo?: string | null;
  /** Dias que o dono costuma empurrar (histórico); vazio = usa o padrão. */
  historicoDias?: number[];
  horarios?: HorariosTurno;
  fuso?: string;
}

export interface DestinoAdiamento {
  /** Data local 'YYYY-MM-DD'. */
  data: string;
  /** Hora local 'HH:MM'. */
  hora: string;
  /** Data-hora local sem fuso, no formato que o Todoist aceita em `due_datetime`. */
  dataHoraLocal: string;
  motivo: string;
}

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Primeira etiqueta de adiamento presente na tarefa, ou null. */
export function lerEtiquetaAdiamento(labels: readonly string[]): EtiquetaAdiamento | null {
  const normalizadas = new Set(labels.map(normalizar));
  return ETIQUETAS_ADIAMENTO.find((e) => normalizadas.has(e)) ?? null;
}

/** Relógio local (data + hora) de um instante num fuso. */
export function relogioLocal(agora: Date, fuso: string): { data: string; hora: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? '00';
  return { data: `${p('year')}-${p('month')}-${p('day')}`, hora: Number(p('hour')) };
}

/** Soma dias a uma data 'YYYY-MM-DD' (aritmética de calendário, sem fuso). */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number);
  const base = new Date(Date.UTC(a ?? 2000, (m ?? 1) - 1, d ?? 1));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

function destino(data: string, hora: number, motivo: string): DestinoAdiamento {
  const hh = String(hora).padStart(2, '0');
  return { data, hora: `${hh}:00`, dataHoraLocal: `${data}T${hh}:00:00`, motivo };
}

function mediana(valores: number[]): number {
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 ? (ord[meio] ?? 0) : ((ord[meio - 1] ?? 0) + (ord[meio] ?? 0)) / 2;
}

/** Próximo turno a partir da hora local (RN-13: mínimo de adiamento). */
function proximoTurno(hoje: string, hora: number, h: HorariosTurno): DestinoAdiamento {
  if (hora < h.tarde) return destino(hoje, h.tarde, 'próximo turno (tarde)');
  if (hora < h.noite) return destino(hoje, h.noite, 'próximo turno (noite)');
  return destino(somarDias(hoje, 1), h.manha, 'próximo turno (amanhã de manhã)');
}

/** Dias que `@adiar` empurra um item de prioridade baixa, a partir do histórico. */
export function diasPorHistorico(historicoDias: readonly number[] | undefined): number {
  const validos = (historicoDias ?? []).filter((d) => Number.isFinite(d) && d >= 1);
  if (validos.length < 3) return DIAS_PADRAO_ADIAR;
  return Math.min(DIAS_MAX_ADIAR, Math.max(1, Math.round(mediana(validos))));
}

/**
 * Decide para quando o item vai, conforme a etiqueta.
 * - `tarde`: hoje no turno da tarde (se já passou, cai na noite).
 * - `noite`: hoje no turno da noite (se já passou, amanhã de manhã).
 * - `amanha`: amanhã de manhã.
 * - `adiar`: p1 → próximo turno; p2 → amanhã de manhã; p3/p4 → N dias pelo histórico.
 * Com prazo, nunca passa de 1 dia antes do prazo de manhã (RN-14), mas nunca
 * fica antes do próximo turno (RN-13).
 */
export function calcularDestino(e: EntradaAdiamento): DestinoAdiamento {
  const h = e.horarios ?? HORARIOS_PADRAO;
  const { data: hoje, hora } = relogioLocal(e.agora, e.fuso ?? FUSO_PADRAO);
  const minimo = proximoTurno(hoje, hora, h);

  let alvo: DestinoAdiamento;
  switch (e.etiqueta) {
    case 'tarde':
      alvo = hora < h.tarde ? destino(hoje, h.tarde, 'hoje à tarde') : minimo;
      break;
    case 'noite':
      alvo = hora < h.noite ? destino(hoje, h.noite, 'hoje à noite') : minimo;
      break;
    case 'amanha':
      alvo = destino(somarDias(hoje, 1), h.manha, 'amanhã de manhã');
      break;
    case 'adiar': {
      if (e.prioridadeApi === 4) {
        alvo = minimo;
      } else if (e.prioridadeApi === 3) {
        alvo = destino(somarDias(hoje, 1), h.manha, 'prioridade 2: amanhã de manhã');
      } else {
        const dias = diasPorHistorico(e.historicoDias);
        alvo = destino(somarDias(hoje, dias), h.manha, `seu padrão: +${dias} dia(s)`);
      }
      break;
    }
  }

  if (e.prazo) {
    const limite = somarDias(e.prazo, -1);
    if (alvo.data > limite) {
      alvo = destino(limite, h.manha, `1 dia antes do prazo (${e.prazo})`);
      if (alvo.dataHoraLocal < minimo.dataHoraLocal) {
        alvo = { ...minimo, motivo: `prazo perto (${e.prazo}): ${minimo.motivo}` };
      }
    }
  }
  return alvo;
}

/** Dias inteiros entre duas datas 'YYYY-MM-DD' (ou ISO), usado para ler o histórico. */
export function diasEntre(de: string, ate: string): number {
  const a = Date.parse(de.slice(0, 10));
  const b = Date.parse(ate.slice(0, 10));
  return Math.round((b - a) / 86_400_000);
}
