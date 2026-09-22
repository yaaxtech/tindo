import { describe, expect, it } from 'vitest';
import { fmtDuracao, fmtInt, fmtPct, fmtTokens } from './formato';

describe('formato pt-BR', () => {
  it('formata percentual, inteiro, tokens e duração', () => {
    expect(fmtPct(72.44)).toBe('72,4%');
    expect(fmtInt(1843200)).toBe('1.843.200');
    expect(fmtTokens(9870)).toBe('9,9 mil');
    expect(fmtTokens(2917450)).toBe('2,9 mi');
    expect(fmtDuracao(538.2)).toBe('9 min');
    expect(fmtDuracao(45)).toBe('45 s');
  });

  it('nulo vira traço, nunca 0', () => {
    for (const f of [fmtPct, fmtInt, fmtTokens, fmtDuracao]) expect(f(null)).toBe('—');
  });
});
