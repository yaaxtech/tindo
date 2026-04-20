/**
 * Testes unitários para sm2.ts (SM-2 adaptado para adiamento de tarefas).
 * Ref: docs/11_ADIAMENTO_ESPACADO.md — seção "Fórmula" e task M2.
 */

import { describe, expect, it } from 'vitest';
import { calcularProximaAdiada } from './sm2';

// ---------------------------------------------------------------------------
// Helpers de teste
// ---------------------------------------------------------------------------

/** Cria Date no horário local: hoje às h:00:00 */
function hojeHora(h: number): Date {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d;
}

/** YYYY-MM-DD de Date */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' de hoje + N dias */
function daqui(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Extrai hora local de um ISO timestamptz */
function horaLocal(iso: string): number {
  return new Date(iso).getHours();
}

/** Extrai data local (YYYY-MM-DD) de um ISO timestamptz */
function dataLocal(iso: string): string {
  return toDateStr(new Date(iso));
}

// ---------------------------------------------------------------------------
// Testes de intervalo base + próximo turno
// ---------------------------------------------------------------------------

describe('calcularProximaAdiada — score alto (70-100), próximo turno', () => {
  it('score 95, ef 2.0, count 0, agora=hoje 10h (manhã) → adiadaAte=hoje 14:00', () => {
    const agora = hojeHora(10);
    const res = calcularProximaAdiada({
      score: 95,
      ef: 2.0,
      adiamentoCount: 0,
      agora,
      horaDoDiaAlvo: 14,
    });
    expect(dataLocal(res.adiadaAte)).toBe(toDateStr(agora)); // hoje
    expect(horaLocal(res.adiadaAte)).toBe(14);
  });

  it('agora=hoje 20h (noite) + score 95 → adiadaAte=amanhã 09:00 (próximo turno = manhã)', () => {
    const agora = hojeHora(20);
    const res = calcularProximaAdiada({
      score: 95,
      ef: 2.0,
      adiamentoCount: 0,
      agora,
      horaDoDiaAlvo: 9,
    });
    const amanha = new Date(agora);
    amanha.setDate(amanha.getDate() + 1);
    expect(dataLocal(res.adiadaAte)).toBe(toDateStr(amanha));
    expect(horaLocal(res.adiadaAte)).toBe(9);
  });

  it('agora=hoje 8h (manhã) + score 95, horaAlvo=14 → adiadaAte=hoje 14:00', () => {
    const agora = hojeHora(8);
    const res = calcularProximaAdiada({
      score: 95,
      ef: 2.0,
      adiamentoCount: 0,
      agora,
      horaDoDiaAlvo: 14,
    });
    expect(dataLocal(res.adiadaAte)).toBe(toDateStr(agora));
    expect(horaLocal(res.adiadaAte)).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// Testes de intervalo base — 1 dia e 4 dias
// ---------------------------------------------------------------------------

describe('calcularProximaAdiada — score médio (40-69), +1 dia', () => {
  it('score 50, ef 2.0, count 0, agora=hoje 10h, horaAlvo=10 → adiadaAte=amanhã 10:00', () => {
    const agora = hojeHora(10);
    const res = calcularProximaAdiada({
      score: 50,
      ef: 2.0,
      adiamentoCount: 0,
      agora,
      horaDoDiaAlvo: 10,
    });
    const amanha = new Date(agora);
    amanha.setDate(amanha.getDate() + 1);
    expect(dataLocal(res.adiadaAte)).toBe(toDateStr(amanha));
    expect(horaLocal(res.adiadaAte)).toBe(10);
  });
});

describe('calcularProximaAdiada — score baixo (0-19), +4 dias', () => {
  it('score 10, ef 2.0, count 0, agora=hoje 10h, horaAlvo=14 → adiadaAte=hoje+4d 14:00', () => {
    const agora = hojeHora(10);
    const res = calcularProximaAdiada({
      score: 10,
      ef: 2.0,
      adiamentoCount: 0,
      agora,
      horaDoDiaAlvo: 14,
    });
    const alvo = new Date(agora);
    alvo.setDate(alvo.getDate() + 4);
    expect(dataLocal(res.adiadaAte)).toBe(toDateStr(alvo));
    expect(horaLocal(res.adiadaAte)).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// Teto 14 dias
// ---------------------------------------------------------------------------

describe('calcularProximaAdiada — teto 14 dias', () => {
  it('score 50, ef 2.5, count 3 (N=4) → 1 × 2.5³ = 15.625d → travado em 14d', () => {
    const agora = hojeHora(10);
    const res = calcularProximaAdiada({
      score: 50,
      ef: 2.5,
      adiamentoCount: 3,
      agora,
      horaDoDiaAlvo: 10,
    });
    const teto = new Date(agora.getTime() + 14 * 24 * 60 * 60 * 1000);
    // data deve ser ≤ teto
    expect(new Date(res.adiadaAte).getTime()).toBeLessThanOrEqual(
      teto.getTime() + 60 * 1000, // margem de 1min para hora-do-dia
    );
    // deve estar ao redor de D+14
    const diffDias = (new Date(res.adiadaAte).getTime() - agora.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBeGreaterThan(13);
    expect(diffDias).toBeLessThanOrEqual(14.1);
  });
});

// ---------------------------------------------------------------------------
// Trava de prazo
// ---------------------------------------------------------------------------

describe('calcularProximaAdiada — trava prazoConclusao', () => {
  it('prazoConclusao=hoje+2d, intervalo=+5d → adiadaAte=hoje+1d 09:00', () => {
    const agora = hojeHora(10);
    const prazo = daqui(2);
    const res = calcularProximaAdiada({
      score: 50,
      ef: 2.5,
      adiamentoCount: 0,
      prazoConclusao: prazo,
      agora,
      horaDoDiaAlvo: 14,
    });
    // limite = prazo − 1d às 09:00 = hoje+1d 09:00
    const esperado = new Date(agora);
    esperado.setDate(esperado.getDate() + 1);
    esperado.setHours(9, 0, 0, 0);
    expect(new Date(res.adiadaAte).getTime()).toBe(esperado.getTime());
  });

  it('prazoConclusao=hoje, agora=hoje 10h → adiadaAte=hoje 14:00 (turno), alertaPrazo=true', () => {
    const agora = hojeHora(10);
    const prazo = toDateStr(agora);
    const res = calcularProximaAdiada({
      score: 50,
      ef: 2.0,
      adiamentoCount: 0,
      prazoConclusao: prazo,
      agora,
      horaDoDiaAlvo: 14,
    });
    // limitePrazo = hoje − 1d às 09:00 = ontem 09:00 < turno (hoje 14:00)
    // → força próximo turno + alertaPrazo
    expect(horaLocal(res.adiadaAte)).toBe(14);
    expect(dataLocal(res.adiadaAte)).toBe(toDateStr(agora));
    expect(res.alertaPrazo).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// novoEf
// ---------------------------------------------------------------------------

describe('calcularProximaAdiada — novoEf', () => {
  it('score 100, ef 2.0, count 5 → novoEf === 2.00 (growth = 0)', () => {
    const res = calcularProximaAdiada({
      score: 100,
      ef: 2.0,
      adiamentoCount: 5,
      agora: hojeHora(10),
      horaDoDiaAlvo: 14,
    });
    expect(res.novoEf).toBe(2.0);
  });

  it('score 0, ef 2.0, count 0 → novoEf === 2.10', () => {
    const res = calcularProximaAdiada({
      score: 0,
      ef: 2.0,
      adiamentoCount: 0,
      agora: hojeHora(10),
      horaDoDiaAlvo: 14,
    });
    expect(res.novoEf).toBe(2.1);
  });

  it('score 50, ef 3.0, count 5 → novoEf travado em 3.00 (não passa do teto)', () => {
    const res = calcularProximaAdiada({
      score: 50,
      ef: 3.0,
      adiamentoCount: 5,
      agora: hojeHora(10),
      horaDoDiaAlvo: 14,
    });
    expect(res.novoEf).toBe(3.0);
  });
});

// ---------------------------------------------------------------------------
// Motivo
// ---------------------------------------------------------------------------

describe('calcularProximaAdiada — motivo', () => {
  it('motivo contém "SM-2:" e os valores chave', () => {
    const res = calcularProximaAdiada({
      score: 75,
      ef: 2.0,
      adiamentoCount: 1,
      agora: hojeHora(10),
      horaDoDiaAlvo: 14,
    });
    expect(res.motivo).toMatch(/SM-2:/);
    expect(res.motivo).toMatch(/score=75/);
    expect(res.motivo).toMatch(/N=2/);
    expect(res.motivo).toMatch(/EF=2\.00/);
  });
});
