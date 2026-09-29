import { describe, expect, it } from 'vitest';
import {
  type EntradaModeloNotion,
  faixaUrgencia,
  notaDe0a100,
  scoreModeloNotion,
} from './modelo-notion';

const agora = new Date('2026-09-29T12:00:00Z');
const horas = (h: number) => new Date(agora.getTime() + h * 3_600_000);

const base: EntradaModeloNotion = {
  importancia: 4,
  tempoMinutos: 20,
  tipoTarefa: null,
  numeroMeta: null,
  dataLimite: null,
  bloqueada: false,
  congelada: false,
  topoLembrete: false,
  reducao: 1,
  sumirAte: null,
};

describe('faixaUrgencia (🚨 Urgência)', () => {
  it.each([
    [null, 'mes'],
    [-25, 'atrasada'],
    [-1, 'hoje'],
    [100, 'semana'],
    [600, 'mes'],
    [4000, 'semestre'],
    [5000, 'ano'],
  ] as const)('%s horas → %s', (h, faixa) => {
    expect(faixaUrgencia(h === null ? null : horas(h), agora)).toBe(faixa);
  });
});

describe('scoreModeloNotion (🌟 Score)', () => {
  it('reproduz a conta do Notion: round((gold/tempo + urgPts)/10) × multiplicadores', () => {
    // Essencial (7500) em 20 min, sem data (300 pts): round((375 + 300)/10) = 68
    expect(scoreModeloNotion(base, agora)).toBe(68);
    // Produção de Ganho ×1,5 e meta 4 → ×1,2
    expect(scoreModeloNotion({ ...base, tipoTarefa: 'ganho', numeroMeta: 4 }, agora)).toBeCloseTo(
      68 * 1.5 * 1.2,
    );
    // Prevenção de Dor ×0,7 e redução de projeto 0,5
    expect(scoreModeloNotion({ ...base, tipoTarefa: 'dor', reducao: 0.5 }, agora)).toBeCloseTo(
      68 * 0.7 * 0.5,
    );
  });

  it('atraso domina qualquer importância', () => {
    const atrasadaBoba = { ...base, importancia: 1 as const, dataLimite: horas(-48) };
    const criticaSemData = { ...base, importancia: 5 as const, tempoMinutos: 1 };
    expect(scoreModeloNotion(atrasadaBoba, agora)).toBeGreaterThan(
      scoreModeloNotion(criticaSemData, agora),
    );
  });

  it('congelada = 0, bloqueada = 1, escondida fica negativa, Topo Lembrete vai pro topo', () => {
    expect(scoreModeloNotion({ ...base, congelada: true }, agora)).toBe(0);
    expect(scoreModeloNotion({ ...base, bloqueada: true }, agora)).toBe(1);
    expect(scoreModeloNotion({ ...base, sumirAte: horas(24) }, agora)).toBeLessThan(0);
    expect(scoreModeloNotion({ ...base, sumirAte: horas(-1) }, agora)).toBe(68);
    expect(scoreModeloNotion({ ...base, topoLembrete: true }, agora)).toBe(68 + 999_999);
  });

  it('sem tempo informado assume 15 minutos', () => {
    // round((7500/15 + 300)/10) = 80
    expect(scoreModeloNotion({ ...base, tempoMinutos: null }, agora)).toBe(80);
  });
});

describe('notaDe0a100', () => {
  it('mantém a ordem e cabe em 0–100', () => {
    const notas = [1, 10, 68, 800, 100_000, 1e7].map(notaDe0a100);
    expect(notas[0]).toBe(0);
    expect(notas).toEqual([...notas].sort((a, b) => a - b));
    expect(notas.at(-1)).toBe(100);
  });
});
