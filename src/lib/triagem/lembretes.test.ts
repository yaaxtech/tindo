import { describe, expect, it } from 'vitest';
import { avaliarTipo, destinoDoBotao, ehLembrete, lerData, sugerirParaLembrete } from './lembretes';

// 30/09/2026 10:00 em Fortaleza (UTC-3).
const agora = new Date('2026-09-30T13:00:00Z');

describe('ehLembrete', () => {
  it('projeto de lembretes ou Entrada com etiqueta', () => {
    expect(ehLembrete('1. Maioli | Lembretes', false, [])).toBe(true);
    expect(ehLembrete('1. ⏲Falar ou Ativ. Rapidas', false, [])).toBe(true);
    expect(ehLembrete('Inbox', true, ['maioli'])).toBe(true);
    expect(ehLembrete('Inbox', true, [])).toBe(false);
    expect(ehLembrete('2. Maioli | ToDo', false, ['maioli'])).toBe(false);
  });
});

describe('avaliarTipo', () => {
  it('ação rápida fica lembrete', () => {
    expect(avaliarTipo('Falar com mayane pai da Lia', '').pareceTarefa).toBe(false);
    expect(avaliarTipo('ver ITR se ta no meu nome: [Portal](https://x)', '').pareceTarefa).toBe(
      false,
    );
  });

  it('verbo de trabalho longo ou descrição com passos parece tarefa', () => {
    expect(avaliarTipo('Melhorar harness', '').pareceTarefa).toBe(true);
    expect(avaliarTipo('bacia', '- plano poço\n- bomba 10cv\n- canos').pareceTarefa).toBe(true);
  });
});

describe('sugerirParaLembrete', () => {
  const base = { agora, recorrente: false, prioridadeApi: 1 as const };

  it('em dia não sugere adiar', () => {
    const s = sugerirParaLembrete({ ...base, vencimento: '2026-09-30' });
    expect(s.destino).toBeNull();
    expect(s.atraso).toBe(0);
  });

  it('avulso atrasado há uma semana sugere recorrência', () => {
    const s = sugerirParaLembrete({ ...base, vencimento: '2026-09-22' });
    expect(s.atraso).toBe(8);
    expect(s.texto).toContain('recorrente');
    expect(s.destino?.data).toBe('2026-10-02');
  });

  it('recorrente atrasado sugere espaçar', () => {
    const s = sugerirParaLembrete({ ...base, recorrente: true, vencimento: '2026-09-25T15:00:00' });
    expect(s.texto).toContain('espaçar');
  });
});

describe('destinoDoBotao', () => {
  it('tarde, noite e amanhã usam os turnos do dono', () => {
    expect(destinoDoBotao('tarde', agora)?.dataHoraLocal).toBe('2026-09-30T14:00:00');
    expect(destinoDoBotao('noite', agora)?.dataHoraLocal).toBe('2026-09-30T19:00:00');
    expect(destinoDoBotao('amanha', agora)?.dataHoraLocal).toBe('2026-10-01T09:00:00');
  });

  it('outra data vai de manhã e recusa data passada', () => {
    expect(destinoDoBotao('data', agora, '05/10')?.dataHoraLocal).toBe('2026-10-05T09:00:00');
    expect(destinoDoBotao('data', agora, '29/09/2026')).toBeNull();
  });
});

describe('lerData', () => {
  it('sem ano pega a próxima ocorrência', () => {
    expect(lerData('15/01', '2026-09-30')).toBe('2027-01-15');
    expect(lerData('2026-10-10', '2026-09-30')).toBe('2026-10-10');
  });

  it('recusa data impossível', () => {
    expect(lerData('31/02', '2026-09-30')).toBeNull();
    expect(lerData('amanhã', '2026-09-30')).toBeNull();
  });
});
