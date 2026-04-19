/**
 * Heurística pura de sugestão de adiamento.
 * Input: histórico de ações do usuário + contexto da tarefa atual.
 * Output: horário alvo + motivo + grau de confiança.
 */

export interface AcaoAdiamentoPassada {
  criadaEm: string;
  ateISO: string;
  tags: string[];
  projetoId: string | null;
  diaSemana: number;
  horaDia: number;
}

export interface ContextoTarefa {
  tags: string[];
  projetoId: string | null;
  agora?: Date;
}

export interface SugestaoAdiamento {
  ateISO: string;
  motivo: string;
  confianca: number;
  amostra: number;
  fallback: boolean;
}

const MIN_AMOSTRAS = 3;

export function sugerirAdiamento(
  historico: AcaoAdiamentoPassada[],
  ctx: ContextoTarefa,
): SugestaoAdiamento {
  const agora = ctx.agora ?? new Date();

  const comTag = historico.filter((h) => h.tags.some((t) => ctx.tags.includes(t)));
  const comProjeto = historico.filter((h) => h.projetoId && h.projetoId === ctx.projetoId);
  const comDia = historico.filter((h) => h.diaSemana === agora.getDay());

  const buckets: Array<{ lista: AcaoAdiamentoPassada[]; etiqueta: string; peso: number }> = [
    { lista: intersecao(comTag, comDia), etiqueta: 'tag+dia', peso: 3 },
    { lista: intersecao(comProjeto, comDia), etiqueta: 'projeto+dia', peso: 2.5 },
    { lista: comTag, etiqueta: 'tag', peso: 2 },
    { lista: comProjeto, etiqueta: 'projeto', peso: 1.5 },
    { lista: comDia, etiqueta: 'dia', peso: 1 },
  ];

  for (const b of buckets) {
    if (b.lista.length >= MIN_AMOSTRAS) {
      const deltaHorasMediana = medianaDeltaHoras(b.lista);
      const alvo = new Date(agora.getTime() + deltaHorasMediana * 3_600_000);
      return {
        ateISO: alvo.toISOString(),
        motivo: `Padrão detectado (${b.etiqueta}, ${b.lista.length} amostras)`,
        confianca: Math.min(1, (b.lista.length / 10) * (b.peso / 3)),
        amostra: b.lista.length,
        fallback: false,
      };
    }
  }

  return { ...fallback(agora), amostra: 0, fallback: true };
}

function intersecao<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

function medianaDeltaHoras(hs: AcaoAdiamentoPassada[]): number {
  const deltas = hs
    .map((h) => (new Date(h.ateISO).getTime() - new Date(h.criadaEm).getTime()) / 3_600_000)
    .filter((d) => d > 0 && d < 24 * 30)
    .sort((a, b) => a - b);
  if (deltas.length === 0) return 24;
  const mid = Math.floor(deltas.length / 2);
  return deltas.length % 2 === 0 ? (deltas[mid - 1]! + deltas[mid]!) / 2 : deltas[mid]!;
}

function fallback(agora: Date): Omit<SugestaoAdiamento, 'amostra' | 'fallback'> {
  const hora = agora.getHours();
  const alvo = new Date(agora);
  let motivo = '';
  if (hora < 12) {
    alvo.setHours(14, 0, 0, 0);
    motivo = 'Sem histórico — sugerindo hoje à tarde';
  } else if (hora < 17) {
    alvo.setHours(19, 0, 0, 0);
    motivo = 'Sem histórico — sugerindo hoje à noite';
  } else {
    alvo.setDate(alvo.getDate() + 1);
    alvo.setHours(9, 0, 0, 0);
    motivo = 'Sem histórico — sugerindo amanhã cedo';
  }
  return { ateISO: alvo.toISOString(), motivo, confianca: 0 };
}

export function rotuloMotivoManual(ate: Date, agora = new Date()): string {
  const deltaH = (ate.getTime() - agora.getTime()) / 3_600_000;
  if (deltaH < 6) return `+${Math.round(deltaH)}h (manual)`;
  if (ehMesmoDia(ate, agora)) return 'hoje mais tarde (manual)';
  if (ehAmanha(ate, agora)) return 'amanhã (manual)';
  const dias = Math.round(deltaH / 24);
  return `+${dias} dias (manual)`;
}

function ehMesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function ehAmanha(a: Date, b: Date): boolean {
  const amanha = new Date(b);
  amanha.setDate(amanha.getDate() + 1);
  return ehMesmoDia(a, amanha);
}
