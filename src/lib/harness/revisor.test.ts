import type { Assinatura, GithubRunLinha, LedgerLinha } from '@/types/harness';
import { describe, expect, it } from 'vitest';
import type { Violacao } from './alertas';
import { type AvaliacaoGravada, type PortasRevisor, resumoRevisao, revisarKpis } from './revisor';

const AGORA = Date.parse('2026-08-13T12:00:00Z');
const DIA = 864e5;

const ASSINATURAS: Assinatura[] = [
  { nome: 'Anthropic', frente: 'claude', valor: 200, renova: '2026-09-22', papel: 'cérebro' },
];

/** 20 despachos, 10 aceitos de primeira → qualidade e placar violados. */
const LEDGER_RUIM: LedgerLinha[] = Array.from({ length: 20 }, (_, i) => ({
  ts: new Date(AGORA - 2 * DIA).toISOString(),
  frente: 'codex',
  modelo: 'gpt-5.6-luna',
  effort: 'max',
  terreno: 'rotina',
  resultado: i < 10 ? 'ok1' : 'retrabalho',
  papel: 'construtor',
  tarefa: 'x',
  nota: null,
  dur: null,
}));

interface Espiao {
  portas: PortasRevisor;
  gravadas: AvaliacaoGravada[];
  avisos: Violacao[][];
}

function espiao(over: Partial<PortasRevisor> = {}, ultimaEm: string | null = null): Espiao {
  const gravadas: AvaliacaoGravada[] = [];
  const avisos: Violacao[][] = [];
  const portas: PortasRevisor = {
    lerLedger: async () => ({ ledger: LEDGER_RUIM, assinaturas: ASSINATURAS }),
    lerRuns: async (): Promise<GithubRunLinha[]> => [],
    ultimaAvaliacaoEm: async () => ultimaEm,
    gravar: async (a) => {
      gravadas.push(a);
      return { erro: null };
    },
    avisar: async (v) => {
      avisos.push(v);
    },
    ...over,
  };
  return { portas, gravadas, avisos };
}

describe('revisarKpis', () => {
  it('avalia, grava e avisa quando o calendário manda', async () => {
    const { portas, gravadas, avisos } = espiao();
    const r = await revisarKpis(portas, { agora: AGORA });

    expect(r.avaliou).toBe(true);
    expect(r.motivo).toBe('periodico');
    expect(r.violacoes).toBeGreaterThan(0);
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]?.janelaDias).toBe(14);
    expect(gravadas[0]?.violacoes.map((v) => v.codigo)).toContain('qualidade_baixa');
    expect(avisos).toHaveLength(1);
  });

  it('não avalia nem grava fora do calendário', async () => {
    const ontem = new Date(AGORA - DIA).toISOString();
    const { portas, gravadas, avisos } = espiao({}, ontem);
    const r = await revisarKpis(portas, { agora: AGORA });

    expect(r.avaliou).toBe(false);
    expect(r.nota).toBe('fora do calendário');
    expect(r.proximaEm).toBe(new Date(Date.parse(ontem) + 14 * DIA).toISOString());
    expect(gravadas).toEqual([]);
    expect(avisos).toEqual([]);
  });

  it('não avalia sem snapshot publicado', async () => {
    const { portas, gravadas } = espiao({ lerLedger: async () => null });
    const r = await revisarKpis(portas, { agora: AGORA });

    expect(r.avaliou).toBe(false);
    expect(r.nota).toBe('sem snapshot do harness ainda');
    expect(gravadas).toEqual([]);
  });

  it('grava mesmo quando os tempos do GitHub falham, e registra a nota', async () => {
    const { portas, gravadas } = espiao({
      lerRuns: async () => {
        throw new Error('timeout');
      },
    });
    const r = await revisarKpis(portas, { agora: AGORA });

    expect(r.avaliou).toBe(true);
    expect(r.nota).toContain('tempos do GitHub fora');
    expect(gravadas).toHaveLength(1);
  });

  it('não avisa quando nada violou', async () => {
    const limpo: LedgerLinha[] = Array.from({ length: 40 }, () => ({
      ts: new Date(AGORA - DIA).toISOString(),
      frente: 'codex',
      modelo: 'gpt-5.6-luna',
      effort: 'max',
      terreno: 'rotina',
      resultado: 'ok1',
      papel: 'construtor',
      tarefa: 'x',
      nota: null,
      dur: null,
    }));
    // Uma quota na janela impede o alerta de "assinatura sobrando".
    limpo[0] = { ...(limpo[0] as LedgerLinha), resultado: 'quota' };
    const { portas, avisos, gravadas } = espiao({
      lerLedger: async () => ({
        ledger: limpo,
        assinaturas: [{ nome: 'X', frente: 'codex', valor: 20, renova: '2026-09-30', papel: 'p' }],
      }),
    });
    const r = await revisarKpis(portas, { agora: AGORA });

    expect(r.avaliou).toBe(true);
    expect(r.violacoes).toBe(0);
    expect(gravadas[0]?.violacoes).toEqual([]);
    expect(avisos).toEqual([]);
  });

  it('reporta falha de gravação sem lançar', async () => {
    const { portas, avisos } = espiao({ gravar: async () => ({ erro: 'coluna faltando' }) });
    const r = await revisarKpis(portas, { agora: AGORA });

    expect(r.avaliou).toBe(false);
    expect(r.nota).toContain('coluna faltando');
    expect(avisos).toEqual([]);
  });

  it('erro inesperado vira nota, nunca exceção', async () => {
    const { portas } = espiao({
      lerLedger: async () => {
        throw new Error('supabase fora');
      },
    });
    const r = await revisarKpis(portas, { agora: AGORA });

    expect(r.avaliou).toBe(false);
    expect(r.nota).toContain('supabase fora');
  });
});

describe('resumoRevisao', () => {
  it('resume os três desfechos em uma linha', () => {
    expect(
      resumoRevisao({
        avaliou: false,
        motivo: null,
        violacoes: 0,
        criticos: 0,
        nota: 'fora do calendário',
        proximaEm: null,
      }),
    ).toBe('não avaliou (fora do calendário)');

    expect(
      resumoRevisao({
        avaliou: true,
        motivo: 'periodico',
        violacoes: 0,
        criticos: 0,
        nota: null,
        proximaEm: null,
      }),
    ).toContain('nenhum limiar violado');

    expect(
      resumoRevisao({
        avaliou: true,
        motivo: 'pre_renovacao',
        violacoes: 3,
        criticos: 1,
        nota: null,
        proximaEm: null,
      }),
    ).toBe('avaliação pre_renovacao: 3 limiar(es) violado(s), 1 crítico(s)');
  });
});
