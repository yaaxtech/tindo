import { describe, expect, it } from 'vitest';
import { zonaDoDrop } from './MenuDocumentos';

describe('zonaDoDrop', () => {
  it('solta em cima do item = vira filha', () => {
    expect(zonaDoDrop(0, 24)).toBe('filha');
    expect(zonaDoDrop(12, 24)).toBe('filha');
  });

  it('solta na faixa de baixo = vira irmã', () => {
    expect(zonaDoDrop(20, 24)).toBe('irma');
    expect(zonaDoDrop(24, 24)).toBe('irma');
  });

  it('altura zero (item ainda sem layout) cai em filha, sem dividir por zero', () => {
    expect(zonaDoDrop(0, 0)).toBe('filha');
  });
});
