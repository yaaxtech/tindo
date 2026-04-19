/**
 * Cálculo dos 3 anéis semanais do estilo Apple Fitness.
 * Lib pura — sem dependências externas, testável.
 */

export interface DiaAtividade {
  /** Data no formato YYYY-MM-DD */
  dia: string;
  /** Número de tarefas/lembretes concluídos neste dia */
  conclusoes: number;
  /** Horas (0-23) em que cada conclusão ocorreu */
  horasConclusao: number[];
}

export interface AneisValor {
  valor: number;
  meta: number;
  percentual: number;
}

export interface Aneis {
  concluir: AneisValor;
  foco: AneisValor;
  consistencia: AneisValor;
}

/**
 * Calcula os 3 anéis semanais.
 *
 * @param dias - Atividade dos últimos 7 dias (pode ter menos entradas se dias sem atividade)
 * @param metaSemanal - Meta de conclusões para a semana (default 35)
 * @param horarioPreferido - Hora preferida do usuário (0-23). Se undefined, calcula a moda.
 */
export function calcularAneis(
  dias: DiaAtividade[],
  metaSemanal = 35,
  horarioPreferido?: number,
): Aneis {
  // Anel 1 — Concluir: dias com ao menos 1 conclusão / 7
  const diasComConclusao = dias.filter((d) => d.conclusoes > 0).length;
  const metaDias = 7;

  // Anel 2 — Foco: total de conclusões / meta semanal
  const totalConclusoes = dias.reduce((acc, d) => acc + d.conclusoes, 0);

  // Anel 3 — Consistência: dias dentro do horário produtivo ± 2h
  const todasHoras = dias.flatMap((d) => d.horasConclusao);
  const horarioRef = horarioPreferido ?? calcularModa(todasHoras);

  let diasConsistentes = 0;
  if (horarioRef !== undefined && todasHoras.length > 0) {
    diasConsistentes = dias.filter((d) => {
      if (d.horasConclusao.length === 0) return false;
      return d.horasConclusao.some((h) => Math.abs(h - horarioRef) <= 2);
    }).length;
  }

  const clamp = (v: number) => Math.min(100, Math.round(v));

  return {
    concluir: {
      valor: diasComConclusao,
      meta: metaDias,
      percentual: clamp((diasComConclusao / metaDias) * 100),
    },
    foco: {
      valor: totalConclusoes,
      meta: metaSemanal,
      percentual: clamp((totalConclusoes / metaSemanal) * 100),
    },
    consistencia: {
      valor: diasConsistentes,
      meta: metaDias,
      percentual:
        horarioRef !== undefined && todasHoras.length > 0
          ? clamp((diasConsistentes / metaDias) * 100)
          : 0,
    },
  };
}

/** Retorna a moda (valor mais frequente) de um array de números, ou undefined se vazio. */
function calcularModa(valores: number[]): number | undefined {
  if (valores.length === 0) return undefined;
  const freq = new Map<number, number>();
  for (const v of valores) freq.set(v, (freq.get(v) ?? 0) + 1);
  let moda = valores[0];
  let maxFreq = 0;
  for (const [val, cnt] of freq) {
    if (cnt > maxFreq) {
      maxFreq = cnt;
      moda = val;
    }
  }
  return moda;
}
