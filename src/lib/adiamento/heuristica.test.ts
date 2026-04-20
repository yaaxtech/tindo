import { describe, expect, it } from 'vitest';
import {
  type AcaoAdiamentoPassada,
  decidirHoraDoDia,
  rotuloMotivoManual,
  sugerirAdiamento,
} from './heuristica';

function acao(overrides: Partial<AcaoAdiamentoPassada> = {}): AcaoAdiamentoPassada {
  const criadaEm = overrides.criadaEm ?? '2026-04-15T09:00:00Z';
  const ateISO = overrides.ateISO ?? '2026-04-15T18:00:00Z';
  return {
    criadaEm,
    ateISO,
    tags: overrides.tags ?? [],
    projetoId: overrides.projetoId ?? null,
    diaSemana: overrides.diaSemana ?? new Date(criadaEm).getDay(),
    horaDia: overrides.horaDia ?? new Date(criadaEm).getHours(),
  };
}

describe('sugerirAdiamento', () => {
  it('retorna fallback quando não há histórico', () => {
    const agora = new Date('2026-04-19T10:00:00');
    const s = sugerirAdiamento([], { tags: ['x'], projetoId: null, agora });
    expect(s.fallback).toBe(true);
    expect(s.confianca).toBe(0);
    expect(new Date(s.ateISO).getHours()).toBe(14);
  });

  it('detecta padrão por tag+dia com ≥3 amostras', () => {
    const agora = new Date('2026-04-19T09:00:00');
    const historico: AcaoAdiamentoPassada[] = [
      acao({
        tags: ['email'],
        diaSemana: agora.getDay(),
        criadaEm: '2026-04-12T09:00:00',
        ateISO: '2026-04-12T20:00:00',
      }),
      acao({
        tags: ['email'],
        diaSemana: agora.getDay(),
        criadaEm: '2026-04-05T09:00:00',
        ateISO: '2026-04-05T20:00:00',
      }),
      acao({
        tags: ['email'],
        diaSemana: agora.getDay(),
        criadaEm: '2026-03-29T09:00:00',
        ateISO: '2026-03-29T20:00:00',
      }),
    ];
    const s = sugerirAdiamento(historico, { tags: ['email'], projetoId: null, agora });
    expect(s.fallback).toBe(false);
    expect(s.amostra).toBe(3);
    expect(s.motivo).toContain('tag+dia');
  });

  it('prefere bucket com mais peso', () => {
    const agora = new Date('2026-04-19T09:00:00');
    const historico: AcaoAdiamentoPassada[] = [
      acao({
        tags: ['tagA'],
        diaSemana: agora.getDay(),
        criadaEm: '2026-04-12T09:00:00',
        ateISO: '2026-04-12T13:00:00',
      }),
      acao({
        tags: ['tagA'],
        diaSemana: agora.getDay(),
        criadaEm: '2026-04-05T09:00:00',
        ateISO: '2026-04-05T13:00:00',
      }),
      acao({
        tags: ['tagA'],
        diaSemana: agora.getDay(),
        criadaEm: '2026-03-29T09:00:00',
        ateISO: '2026-03-29T13:00:00',
      }),
    ];
    const s = sugerirAdiamento(historico, { tags: ['tagA'], projetoId: 'p1', agora });
    expect(s.motivo).toContain('tag+dia');
  });
});

describe('decidirHoraDoDia', () => {
  it('retorna mediana de horaDia do bucket tag+dia com ≥3 amostras', () => {
    const agora = new Date('2026-04-19T10:00:00'); // domingo = 0
    const diaSemana = agora.getDay();

    const historico: AcaoAdiamentoPassada[] = [
      acao({ tags: ['email'], diaSemana, horaDia: 18 }),
      acao({ tags: ['email'], diaSemana, horaDia: 20 }),
      acao({ tags: ['email'], diaSemana, horaDia: 19 }),
    ];

    const result = decidirHoraDoDia({ tags: ['email'], projeto_id: null }, historico, agora);

    expect(result.fonte).toBe('tag+dia');
    expect(result.hora).toBe(19); // mediana de [18, 19, 20]
    expect(result.confianca).toBeGreaterThan(0);
  });

  it('retorna fallback por turno quando sem histórico — manhã → 14', () => {
    const agora = new Date('2026-04-19T08:00:00');
    const result = decidirHoraDoDia({ tags: ['x'], projeto_id: null }, [], agora);

    expect(result.fonte).toBe('turno');
    expect(result.hora).toBe(14);
    expect(result.confianca).toBe(0);
  });

  it('retorna fallback por turno — tarde → 19', () => {
    const agora = new Date('2026-04-19T14:00:00');
    const result = decidirHoraDoDia({ tags: [], projeto_id: null }, [], agora);

    expect(result.fonte).toBe('turno');
    expect(result.hora).toBe(19);
  });

  it('retorna fallback por turno — noite → 9', () => {
    const agora = new Date('2026-04-19T21:00:00');
    const result = decidirHoraDoDia({ tags: [], projeto_id: null }, [], agora);

    expect(result.fonte).toBe('turno');
    expect(result.hora).toBe(9);
  });

  it('cai no bucket projeto+dia quando tag não tem amostras suficientes', () => {
    const agora = new Date('2026-04-19T09:00:00');
    const diaSemana = agora.getDay();

    const historico: AcaoAdiamentoPassada[] = [
      acao({ tags: ['outro'], projetoId: 'p1', diaSemana, horaDia: 15 }),
      acao({ tags: ['outro'], projetoId: 'p1', diaSemana, horaDia: 16 }),
      acao({ tags: ['outro'], projetoId: 'p1', diaSemana, horaDia: 15 }),
    ];

    const result = decidirHoraDoDia(
      { tags: ['tag-sem-historico'], projeto_id: 'p1' },
      historico,
      agora,
    );

    expect(result.fonte).toBe('projeto+dia');
    expect(result.hora).toBe(15);
  });
});

describe('rotuloMotivoManual', () => {
  it('marca "+Xh (manual)" quando é logo adiante', () => {
    const agora = new Date('2026-04-19T10:00:00');
    const ate = new Date('2026-04-19T13:00:00');
    expect(rotuloMotivoManual(ate, agora)).toBe('+3h (manual)');
  });

  it('marca "hoje mais tarde" quando é mesmo dia à noite', () => {
    const agora = new Date('2026-04-19T10:00:00');
    const ate = new Date('2026-04-19T20:00:00');
    expect(rotuloMotivoManual(ate, agora)).toBe('hoje mais tarde (manual)');
  });

  it('marca "amanhã" quando é dia seguinte', () => {
    const agora = new Date('2026-04-19T10:00:00');
    const ate = new Date('2026-04-20T09:00:00');
    expect(rotuloMotivoManual(ate, agora)).toBe('amanhã (manual)');
  });
});
