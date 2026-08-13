// @vitest-environment node

/**
 * Testes de ganharFreezerAdmin — foco no log em historico_acoes.
 *
 * O insert usava o uuid sentinela '00000000-…' como tarefa_id, que a FK para `tarefas`
 * sempre rejeitou (nenhuma linha com esse id existe), e `acao: 'concluida'`, que se
 * gravasse poluiria n_concluidas, o streak, os anéis e o push de streak em risco.
 */

import { describe, expect, it, vi } from 'vitest';
import { ganharFreezerAdmin } from './gamificacao';

type FakeResult = { data?: unknown; error?: unknown };

interface Operacao {
  tabela: string;
  metodo: string;
  payload: unknown;
}

function makeBuilder(tabela: string, result: FakeResult, ops: Operacao[]) {
  // biome-ignore lint/suspicious/noExplicitAny: builder fake dinâmico
  const builder: Record<string, any> = {};

  // biome-ignore lint/suspicious/noThenProperty: thenable intencional (simula o query builder)
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  builder.catch = (reject: (e: unknown) => unknown) => Promise.resolve(result).catch(reject);
  builder.finally = (fn: () => void) => Promise.resolve(result).finally(fn);

  for (const m of ['select', 'eq', 'maybeSingle']) {
    builder[m] = () => builder;
  }
  for (const m of ['insert', 'update']) {
    builder[m] = (payload: unknown) => {
      ops.push({ tabela, metodo: m, payload });
      return builder;
    };
  }

  return builder;
}

function makeClient(filas: Record<string, FakeResult[]>) {
  const ops: Operacao[] = [];
  const contadores: Record<string, number> = {};

  return {
    ops,
    client: {
      from: vi.fn((tabela: string) => {
        const idx = contadores[tabela] ?? 0;
        contadores[tabela] = idx + 1;
        return makeBuilder(tabela, filas[tabela]?.[idx] ?? { error: null }, ops);
      }),
    },
  };
}

describe('ganharFreezerAdmin — log em historico_acoes', () => {
  it('registra o freezer como ação de sistema, sem tarefa', async () => {
    const { client, ops } = makeClient({
      gamificacao: [{ data: { freezers_disponiveis: 0, total_freezers_ganhos: 2 }, error: null }],
    });

    const info = await ganharFreezerAdmin(client, 'usuario-1', 'streak_7_dias');

    expect(info).toEqual({
      freezersDisponiveis: 1,
      totalFreezersGanhos: 3,
      freezerUsadoEm: null,
    });

    const log = ops.find((o) => o.tabela === 'historico_acoes' && o.metodo === 'insert');
    expect(log?.payload).toEqual({
      usuario_id: 'usuario-1',
      tarefa_id: null,
      acao: 'sistema',
      dados: { origem: 'ganhou_freezer', motivo: 'streak_7_dias' },
    });
  });

  it('não usa acao=concluida nem uuid sentinela', async () => {
    const { client, ops } = makeClient({
      gamificacao: [{ data: { freezers_disponiveis: 1, total_freezers_ganhos: 1 }, error: null }],
    });

    await ganharFreezerAdmin(client, 'usuario-1', 'compra');

    const payload = ops.find((o) => o.tabela === 'historico_acoes')?.payload as {
      acao: string;
      tarefa_id: string | null;
    };
    expect(payload.acao).not.toBe('concluida');
    expect(payload.tarefa_id).not.toBe('00000000-0000-0000-0000-000000000000');
  });

  it('sem registro de gamificação não grava nada', async () => {
    const { client, ops } = makeClient({ gamificacao: [{ data: null, error: null }] });

    const info = await ganharFreezerAdmin(client, 'usuario-1', 'streak');

    expect(info).toBeNull();
    expect(ops).toHaveLength(0);
  });

  it('erro no log não derruba o ganho do freezer', async () => {
    const { client } = makeClient({
      gamificacao: [{ data: { freezers_disponiveis: 0, total_freezers_ganhos: 0 }, error: null }],
      historico_acoes: [{ error: { message: 'boom' } }],
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const info = await ganharFreezerAdmin(client, 'usuario-1', 'streak');

    expect(info?.freezersDisponiveis).toBe(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
