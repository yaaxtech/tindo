import type { LedgerLinha } from '@/types/harness';
import { describe, expect, it } from 'vitest';
import { execMinutos, medidasDoLedger, porFrente, resumoDespacho } from './tempos-despacho';

const AGORA = Date.parse('2026-08-13T12:00:00Z');
const DIA = 86_400_000;

function linha(parcial: Partial<LedgerLinha> = {}): LedgerLinha {
  return {
    ts: '2026-08-13T10:00:00Z',
    ts_fechado: '2026-08-13T10:05:00Z',
    frente: 'codex',
    modelo: 'gpt-5.6-sol',
    effort: 'high',
    terreno: 'rotina',
    resultado: 'ok1',
    tarefa: 'teste',
    nota: 'auto run.sh rc=0 exec=10min',
    dur: null,
    ...parcial,
  };
}

describe('execMinutos', () => {
  it('extrai o marco automático da nota', () => {
    expect(execMinutos('auto run.sh rc=0 exec=19min')).toBe(19);
  });

  it('devolve null para nota nula ou sem exec=', () => {
    expect(execMinutos(null)).toBeNull();
    expect(execMinutos('auto run.sh rc=0')).toBeNull();
  });

  it('devolve null quando há lixo no número', () => {
    expect(execMinutos('auto run.sh exec=1x9min')).toBeNull();
    expect(execMinutos('auto run.sh exec=Infinitymin')).toBeNull();
  });
});

describe('medidasDoLedger', () => {
  it('calcula execução, revisão e total em minutos', () => {
    const [medida] = medidasDoLedger([
      linha({
        ts: '2026-08-13T10:00:00Z',
        ts_fechado: '2026-08-13T10:07:30Z',
        nota: 'auto run.sh rc=0 exec=19min',
        frente: 'kimi',
      }),
    ]);
    expect(medida).toEqual({
      ts: Date.parse('2026-08-13T10:00:00Z'),
      frente: 'kimi',
      execucao: 19,
      revisao: 7.5,
      total: 26.5,
    });
  });

  it('sem ts_fechado mantém revisão e total nulos', () => {
    const [medida] = medidasDoLedger([linha({ ts_fechado: null })]);
    expect(medida?.execucao).toBe(10);
    expect(medida?.revisao).toBeNull();
    expect(medida?.total).toBeNull();
  });

  it('relógio torto vira null, nunca revisão ou total negativos', () => {
    const [medida] = medidasDoLedger([
      linha({ ts: '2026-08-13T10:05:00Z', ts_fechado: '2026-08-13T10:00:00Z' }),
    ]);
    expect(medida?.revisao).toBeNull();
    expect(medida?.total).toBeNull();
  });

  it('exclui pendente antes de qualquer cálculo', () => {
    expect(medidasDoLedger([linha({ resultado: 'pendente' })])).toEqual([]);
  });
});

describe('resumoDespacho', () => {
  const amostra = medidasDoLedger([
    linha({
      ts: new Date(AGORA - DIA).toISOString(),
      ts_fechado: new Date(AGORA - DIA + 2 * 60_000).toISOString(),
      nota: 'exec=10min',
    }),
    linha({
      ts: new Date(AGORA - 2 * DIA).toISOString(),
      ts_fechado: new Date(AGORA - 2 * DIA + 4 * 60_000).toISOString(),
      nota: 'exec=20min',
    }),
    linha({
      ts: new Date(AGORA - 3 * DIA).toISOString(),
      ts_fechado: new Date(AGORA - 3 * DIA + 6 * 60_000).toISOString(),
      nota: 'exec=30min',
    }),
  ]);

  it('resume os três segmentos com p50, p90 e n', () => {
    expect(resumoDespacho(amostra, 7, 0, AGORA)).toEqual({
      execucao: { p50: 20, p90: 30, n: 3 },
      revisao: { p50: 4, p90: 6, n: 3 },
      total: { p50: 24, p90: 36, n: 3 },
    });
  });

  it('amostra vazia devolve p50/p90 nulos e n=0', () => {
    expect(resumoDespacho([], 7, 0, AGORA)).toEqual({
      execucao: { p50: null, p90: null, n: 0 },
      revisao: { p50: null, p90: null, n: 0 },
      total: { p50: null, p90: null, n: 0 },
    });
  });

  it('n=1 e n=2 não explodem', () => {
    expect(resumoDespacho(amostra.slice(0, 1), 7, 0, AGORA).total).toEqual({
      p50: 12,
      p90: 12,
      n: 1,
    });
    expect(resumoDespacho(amostra.slice(0, 2), 7, 0, AGORA).total).toEqual({
      p50: 24,
      p90: 24,
      n: 2,
    });
  });

  it('segue o desloc da janela e ignora o período atual no anterior', () => {
    expect(resumoDespacho(amostra, 7, 1, AGORA).execucao.n).toBe(0);
  });
});

describe('porFrente', () => {
  it('mantém frente sem medida com n=0 em vez de sumir', () => {
    const resumo = porFrente(medidasDoLedger([linha({ frente: 'codex' })]));
    expect(resumo.codex.execucao).toEqual({ p50: 10, p90: 10, n: 1 });
    expect(resumo.kimi.execucao).toEqual({ p50: null, p90: null, n: 0 });
    expect(resumo.claude.revisao.n).toBe(0);
    expect(resumo.cerebro.total.n).toBe(0);
  });
});
