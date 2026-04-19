import { describe, expect, it } from 'vitest';
import { type DiaAtividade, calcularAneis } from './aneis';

describe('calcularAneis', () => {
  it('retorna zeros quando não há dados', () => {
    const result = calcularAneis([], 35);
    expect(result.concluir.valor).toBe(0);
    expect(result.concluir.percentual).toBe(0);
    expect(result.foco.valor).toBe(0);
    expect(result.foco.percentual).toBe(0);
    expect(result.consistencia.percentual).toBe(0);
  });

  it('retorna 100% em todos os anéis quando 7/7 dias com meta batida e horário consistente', () => {
    const dias: DiaAtividade[] = Array.from({ length: 7 }, (_, i) => ({
      dia: `2026-04-${String(i + 1).padStart(2, '0')}`,
      conclusoes: 5,
      horasConclusao: [9, 10],
    }));
    const result = calcularAneis(dias, 35, 9);
    expect(result.concluir.percentual).toBe(100);
    expect(result.foco.percentual).toBe(100);
    expect(result.consistencia.percentual).toBe(100);
  });

  it('calcula corretamente quando a meta semanal é batida exatamente', () => {
    const dias: DiaAtividade[] = Array.from({ length: 5 }, (_, i) => ({
      dia: `2026-04-${String(i + 1).padStart(2, '0')}`,
      conclusoes: 7,
      horasConclusao: [14],
    }));
    const result = calcularAneis(dias, 35, 14);
    expect(result.foco.valor).toBe(35);
    expect(result.foco.percentual).toBe(100);
    expect(result.concluir.valor).toBe(5);
    expect(result.concluir.percentual).toBe(Math.round((5 / 7) * 100));
  });

  it('usa horário preferido para calcular consistência corretamente', () => {
    const dias: DiaAtividade[] = [
      { dia: '2026-04-13', conclusoes: 3, horasConclusao: [8, 9, 10] }, // dentro (±2 de 9)
      { dia: '2026-04-14', conclusoes: 2, horasConclusao: [15, 16] },   // fora (±2 de 9)
      { dia: '2026-04-15', conclusoes: 1, horasConclusao: [11] },        // dentro (|11-9|=2 ≤ 2)
      { dia: '2026-04-16', conclusoes: 2, horasConclusao: [7, 9] },      // dentro (7 está ±2 de 9)
    ];
    const result = calcularAneis(dias, 35, 9);
    // Dias dentro: dia 13 (horas 8,9,10 todas ≤2), dia 15 (hora 11: |11-9|=2), dia 16 (hora 7: |7-9|=2) = 3 dias
    expect(result.consistencia.valor).toBe(3);
  });
});
