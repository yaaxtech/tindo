/**
 * SM-2 adaptado para adiamento de tarefas.
 * Função PURA — sem side effects, sem async, sem DB.
 * Ref: docs/11_ADIAMENTO_ESPACADO.md
 */

export type EntradaSM2 = {
  score: number; // 0-100, nota atual
  ef: number; // 1.30-3.00
  adiamentoCount: number; // quantas vezes já foi adiada ANTES desta (0 = primeira)
  prazoConclusao?: string | null; // ISO date 'YYYY-MM-DD' ou null
  dataVencimento?: string | null; // ISO date ou null
  agora: Date;
  horaDoDiaAlvo: number; // 0-23, hora que a heurística sugere (OBRIGATÓRIO)
};

export type SaidaSM2 = {
  adiadaAte: string; // ISO timestamptz
  novoEf: number; // arredondado 2 casas
  motivo: string; // ex: "SM-2: score=95, N=1, EF=2.00, base=próximo turno, ajustado=hoje 14:00"
  alertaPrazo?: boolean; // true se prazo estourando forçou próximo turno
};

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Intervalo base em HORAS para a 1ª adiada.
 * Score 70+ retorna horas até o próximo turno (calculado a partir de `agora`),
 * garantindo proporção correta quando multiplicado por ef^(N-1).
 */
function baseIntervaloHoras(score: number, agora: Date): { horas: number; label: string } {
  if (score >= 70) {
    const turno = proximoTurno(agora);
    const horas = (turno.getTime() - agora.getTime()) / (60 * 60 * 1000);
    return { horas, label: 'próximo turno' };
  }
  if (score >= 40) return { horas: 24, label: '+1 dia' };
  if (score >= 20) return { horas: 48, label: '+2 dias' };
  return { horas: 96, label: '+4 dias' };
}

/**
 * Calcula o próximo turno a partir de agora.
 * Manhã (00-11) → hoje 14:00
 * Tarde (12-16) → hoje 19:00
 * Noite (17-23) → amanhã 09:00
 */
function proximoTurno(agora: Date): Date {
  const hora = agora.getHours();
  const d = new Date(agora);
  if (hora < 12) {
    // Manhã → hoje 14:00
    d.setHours(14, 0, 0, 0);
  } else if (hora < 17) {
    // Tarde → hoje 19:00
    d.setHours(19, 0, 0, 0);
  } else {
    // Noite → amanhã 09:00
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

/** Adiciona dias (fracionários) a uma data */
function adicionarDias(base: Date, dias: number): Date {
  const ms = dias * 24 * 60 * 60 * 1000;
  return new Date(base.getTime() + ms);
}

/** Aplica hora-do-dia alvo a uma data (mantém a data, troca hora) */
function aplicarHora(data: Date, hora: number): Date {
  const d = new Date(data);
  d.setHours(hora, 0, 0, 0);
  return d;
}

/** Parseia 'YYYY-MM-DD' num Date às 00:00:00 local */
function parseDataISO(s: string): Date {
  const parts = s.split('-').map(Number);
  const ano = parts[0] ?? 2000;
  const mes = parts[1] ?? 1;
  const dia = parts[2] ?? 1;
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
}

/** Arredonda para N casas decimais */
function arredondar(n: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(n * fator) / fator;
}

// ---------------------------------------------------------------------------
// Helper exportado: atualiza EF para adiamento (manual ou auto)
// RN-12/15: ambos contam igual. ef += 0.10 * (1 - score/100), teto 3.00
// ---------------------------------------------------------------------------

/**
 * Calcula o novo EF após um adiamento (manual ou automático).
 * @param ef     EF atual (1.30-3.00)
 * @param score  Nota 0-100 da tarefa
 * @returns novoEf arredondado a 2 casas
 */
export function atualizarEfAdiamento(ef: number, score: number): number {
  return arredondar(Math.min(3.0, ef + 0.1 * (1 - score / 100)), 2);
}

/**
 * Calcula o novo EF após conclusão de uma tarefa.
 * @param ef  EF atual (1.30-3.00)
 * @returns novoEf arredondado a 2 casas (mínimo 1.30)
 */
export function atualizarEfConclusao(ef: number): number {
  return arredondar(Math.max(1.3, ef - 0.3), 2);
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

export function calcularProximaAdiada(e: EntradaSM2): SaidaSM2 {
  const { score, ef, adiamentoCount, prazoConclusao, dataVencimento, agora, horaDoDiaAlvo } = e;

  const N = adiamentoCount + 1;
  const { horas: baseHoras, label: baseLabel } = baseIntervaloHoras(score, agora);
  const turno = proximoTurno(agora);

  // --- cálculo do candidato ---
  // intervaloHoras = base × ef^(N-1) — cresce proporcional ao base original
  const intervaloHoras = baseHoras * ef ** (N - 1);
  let candidato = new Date(agora.getTime() + intervaloHoras * 60 * 60 * 1000);
  // Aplica hora-alvo APENAS quando não estamos no próximo turno de score alto (N=1).
  // Para score 70+ e N=1, respeitamos exatamente o próximo turno (mantém o mínimo).
  const ehProximoTurnoDireto = score >= 70 && N === 1;
  if (!ehProximoTurnoDireto) {
    candidato = aplicarHora(candidato, horaDoDiaAlvo);
  }

  // --- travas ---
  const teto14d = adicionarDias(agora, 14);

  // limitePrazo: menor entre prazoConclusao e dataVencimento, menos 1 dia às 09:00
  const prazosISO = [prazoConclusao, dataVencimento].filter(Boolean) as string[];
  let limitePrazo: Date | null = null;
  for (const iso of prazosISO) {
    const prazoBase = parseDataISO(iso);
    const limite = new Date(prazoBase);
    limite.setDate(limite.getDate() - 1);
    limite.setHours(9, 0, 0, 0);
    if (!limitePrazo || limite < limitePrazo) {
      limitePrazo = limite;
    }
  }

  // min(candidato, teto14d, limitePrazo)
  let adiadaAte = candidato < teto14d ? candidato : teto14d;
  if (limitePrazo && limitePrazo < adiadaAte) {
    adiadaAte = limitePrazo;
  }

  // max(adiadaAte, turno) — garante mínimo
  let alertaPrazo = false;
  if (adiadaAte < turno) {
    adiadaAte = turno;
    if (limitePrazo && limitePrazo < turno) {
      alertaPrazo = true;
    }
  }

  // --- novoEf ---
  const novoEf = arredondar(Math.min(3.0, ef + 0.1 * (1 - score / 100)), 2);

  // --- motivo ---
  const ajustadoStr = adiadaAte.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const motivo = `SM-2: score=${score}, N=${N}, EF=${ef.toFixed(2)}, base=${baseLabel}, ajustado=${ajustadoStr}`;

  return {
    adiadaAte: adiadaAte.toISOString(),
    novoEf,
    motivo,
    ...(alertaPrazo ? { alertaPrazo: true } : {}),
  };
}
