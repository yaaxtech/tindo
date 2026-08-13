// @vitest-environment node

/**
 * O insert que existia aqui mandava `tarefa_id: null` numa coluna NOT NULL — sempre
 * violou a FK e o `try/catch` não via nada (supabase-js devolve `{ error }`).
 * Estes testes fixam o contrato do log de sistema pós-migration 20260813000003.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakeResult = { data?: unknown; error?: unknown };

interface Operacao {
  tabela: string;
  metodo: string;
  payload: unknown;
}

const mocks = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  getUsuarioIdMVP: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: mocks.getAdminClient,
  getUsuarioIdMVP: mocks.getUsuarioIdMVP,
}));

import { POST } from './route';

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

describe('POST /api/todoist/desconectar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUsuarioIdMVP.mockResolvedValue('usuario-1');
  });

  it('registra a desconexão como ação de sistema, sem tarefa', async () => {
    const { client, ops } = makeClient({ configuracoes: [{ error: null }] });
    mocks.getAdminClient.mockReturnValue(client);

    const resposta = await POST();

    expect(resposta.status).toBe(200);
    const log = ops.find((o) => o.tabela === 'historico_acoes' && o.metodo === 'insert');
    expect(log?.payload).toEqual({
      usuario_id: 'usuario-1',
      tarefa_id: null,
      acao: 'sistema',
      dados: { origem: 'todoist_desconectado' },
    });
  });

  it('não usa acao=editada (poluiria a taxaReavaliacao)', async () => {
    const { client, ops } = makeClient({ configuracoes: [{ error: null }] });
    mocks.getAdminClient.mockReturnValue(client);

    await POST();

    const log = ops.find((o) => o.tabela === 'historico_acoes');
    expect((log?.payload as { acao: string }).acao).not.toBe('editada');
  });

  it('não registra log quando a limpeza do token falha', async () => {
    const { client, ops } = makeClient({
      configuracoes: [{ error: { message: 'falhou' } }],
    });
    mocks.getAdminClient.mockReturnValue(client);

    const resposta = await POST();

    expect(resposta.status).toBe(500);
    expect(ops.filter((o) => o.tabela === 'historico_acoes')).toHaveLength(0);
  });

  it('erro no log não derruba a desconexão', async () => {
    const { client } = makeClient({
      configuracoes: [{ error: null }],
      historico_acoes: [{ error: { message: 'boom' } }],
    });
    mocks.getAdminClient.mockReturnValue(client);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const resposta = await POST();

    expect(resposta.status).toBe(200);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
