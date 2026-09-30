import { describe, expect, it } from 'vitest';
import {
  calcularDestino,
  diasEntre,
  diasPorHistorico,
  lerEtiquetaAdiamento,
  relogioLocal,
  somarDias,
} from './etiquetas';

// Fortaleza = UTC-3 (sem horário de verão).
const as = (horaLocal: number) =>
  new Date(`2026-09-29T${String(horaLocal + 3).padStart(2, '0')}:30:00Z`);

describe('lerEtiquetaAdiamento', () => {
  it('reconhece sem acento e sem caixa', () => {
    expect(lerEtiquetaAdiamento(['maioli', 'Amanhã'])).toBe('amanha');
    expect(lerEtiquetaAdiamento(['TARDE'])).toBe('tarde');
  });
  it('ignora etiquetas comuns', () => {
    expect(lerEtiquetaAdiamento(['maioli', 'EM.Coop'])).toBeNull();
  });
});

describe('relogioLocal / somarDias / diasEntre', () => {
  it('converte para o fuso do dono', () => {
    expect(relogioLocal(new Date('2026-09-30T02:00:00Z'), 'America/Fortaleza')).toEqual({
      data: '2026-09-29',
      hora: 23,
    });
  });
  it('vira o mês', () => {
    expect(somarDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(diasEntre('2026-09-29', '2026-10-01T02:59:59Z')).toBe(2);
  });
});

describe('calcularDestino', () => {
  it('@tarde de manhã vai para hoje 14h', () => {
    const d = calcularDestino({ etiqueta: 'tarde', agora: as(10), prioridadeApi: 1 });
    expect(d.dataHoraLocal).toBe('2026-09-29T14:00:00');
  });
  it('@tarde depois das 14h cai na noite', () => {
    const d = calcularDestino({ etiqueta: 'tarde', agora: as(15), prioridadeApi: 1 });
    expect(d.dataHoraLocal).toBe('2026-09-29T19:00:00');
  });
  it('@noite depois das 19h vai para amanhã 9h', () => {
    const d = calcularDestino({ etiqueta: 'noite', agora: as(20), prioridadeApi: 1 });
    expect(d.dataHoraLocal).toBe('2026-09-30T09:00:00');
  });
  it('@amanha vai para amanhã 9h', () => {
    const d = calcularDestino({ etiqueta: 'amanha', agora: as(8), prioridadeApi: 1 });
    expect(d.dataHoraLocal).toBe('2026-09-30T09:00:00');
  });
  it('@adiar em p1 vai para o próximo turno', () => {
    const d = calcularDestino({ etiqueta: 'adiar', agora: as(13), prioridadeApi: 4 });
    expect(d.dataHoraLocal).toBe('2026-09-29T14:00:00');
  });
  it('@adiar em p4 usa o padrão do histórico', () => {
    const d = calcularDestino({
      etiqueta: 'adiar',
      agora: as(13),
      prioridadeApi: 1,
      historicoDias: [1, 3, 3, 3, 7],
    });
    expect(d.dataHoraLocal).toBe('2026-10-02T09:00:00');
  });
  it('respeita 1 dia antes do prazo', () => {
    const d = calcularDestino({
      etiqueta: 'adiar',
      agora: as(10),
      prioridadeApi: 1,
      prazo: '2026-10-01',
    });
    expect(d.dataHoraLocal).toBe('2026-09-30T09:00:00');
  });
  it('prazo estourando nunca fica antes do próximo turno', () => {
    const d = calcularDestino({
      etiqueta: 'amanha',
      agora: as(10),
      prioridadeApi: 1,
      prazo: '2026-09-29',
    });
    expect(d.dataHoraLocal).toBe('2026-09-29T14:00:00');
  });
  it('horários são configuráveis', () => {
    const d = calcularDestino({
      etiqueta: 'tarde',
      agora: as(10),
      prioridadeApi: 1,
      horarios: { manha: 8, tarde: 13, noite: 18 },
    });
    expect(d.hora).toBe('13:00');
  });
});

describe('diasPorHistorico', () => {
  it('usa 2 dias com pouco histórico e limita a 7', () => {
    expect(diasPorHistorico([5])).toBe(2);
    expect(diasPorHistorico([10, 12, 30])).toBe(7);
  });
});
