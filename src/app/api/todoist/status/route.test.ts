// @vitest-environment node

/**
 * A rota filtrava por `acao IN ('sincronizado','todoist_sync','todoist_writeback')` — três
 * valores que nunca existiram no CHECK de historico_acoes.acao. A query era válida, não dava
 * erro e voltava sempre vazia. Estes testes fixam o contrato do filtro pós-migration
 * 20260813000004: o único valor de sync é 'todoist_sync'.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakeResult = { data?: unknown; error?: unknown; count?: number };

interface Filtro {
  tabela: string;
  metodo: string;
  args: unknown[];
}

const mocks = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  getUsuarioIdMVP: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: mocks.getAdminClient,
  getUsuarioIdMVP: mocks.getUsuarioIdMVP,
}));

import { GET } from './route';

function makeBuilder(tabela: string, result: FakeResult, filtros: Filtro[]) {
  // biome-ignore lint/suspicious/noExplicitAny: builder fake dinâmico
  const builder: Record<string, any> = {};

  // biome-ignore lint/suspicious/noThenProperty: thenable intencional (simula o query builder)
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  builder.catch = (reject: (e: unknown) => unknown) => Promise.resolve(result).catch(reject);
  builder.finally = (fn: () => void) => Promise.resolve(result).finally(fn);

  for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'limit', 'maybeSingle']) {
    builder[m] = (...args: unknown[]) => {
      filtros.push({ tabela, metodo: m, args });
      return builder;
    };
  }

  return builder;
}

function makeClient(filas: Record<string, FakeResult[]>) {
  const filtros: Filtro[] = [];
  const contadores: Record<string, number> = {};

  return {
    filtros,
    client: {
      from: vi.fn((tabela: string) => {
        const idx = contadores[tabela] ?? 0;
        contadores[tabela] = idx + 1;
        return makeBuilder(tabela, filas[tabela]?.[idx] ?? { data: [], error: null }, filtros);
      }),
    },
  };
}

/** Filas na ordem em que a rota consulta cada tabela. */
function filasPadrao(acoes: unknown[], tarefas: unknown[] = []) {
  return {
    configuracoes: [{ data: { todoist_token: 'tok', todoist_sync_habilitado: true } }],
    tarefas: [{ count: 3 }, { data: tarefas }],
    projetos: [{ count: 1 }],
    tags: [{ count: 2 }],
    historico_acoes: [{ data: acoes }],
  };
}

function filtrosDoHistorico(filtros: Filtro[]) {
  return filtros.filter((f) => f.tabela === 'historico_acoes');
}

describe('GET /api/todoist/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUsuarioIdMVP.mockResolvedValue('usuario-1');
  });

  it('busca as ações de sync pelo valor real do CHECK (todoist_sync)', async () => {
    const { client, filtros } = makeClient(filasPadrao([]));
    mocks.getAdminClient.mockReturnValue(client);

    const resposta = await GET();

    expect(resposta.status).toBe(200);
    const eqAcao = filtrosDoHistorico(filtros).find(
      (f) => f.metodo === 'eq' && f.args[0] === 'acao',
    );
    expect(eqAcao?.args[1]).toBe('todoist_sync');
  });

  it('não filtra por valores inexistentes no CHECK da coluna', async () => {
    const { client, filtros } = makeClient(filasPadrao([]));
    mocks.getAdminClient.mockReturnValue(client);

    await GET();

    // Os três valores do bug original nunca existiram em historico_acoes.acao.
    const inexistentes = ['sincronizado', 'todoist_writeback', 'todoist_sincronizado'];
    const usados = filtrosDoHistorico(filtros).flatMap((f) => f.args.flat());
    for (const valor of inexistentes) {
      expect(usados).not.toContain(valor);
    }
  });

  it('não conta ação de sync como edição humana (taxaReavaliacao, RN-07)', async () => {
    const { client, filtros } = makeClient(filasPadrao([]));
    mocks.getAdminClient.mockReturnValue(client);

    await GET();

    const usados = filtrosDoHistorico(filtros).flatMap((f) => f.args.flat());
    expect(usados).not.toContain('editada');
  });

  it('devolve as ações reais com título da tarefa e origem preservada', async () => {
    const acoes = [
      {
        id: 'a1',
        acao: 'todoist_sync',
        dados: { origem: 'todoist_writeback', acao: 'concluir' },
        created_at: '2026-08-13T10:00:00Z',
        tarefa_id: 't1',
      },
      {
        id: 'a2',
        acao: 'todoist_sync',
        dados: { origem: 'exportacao_manual', todoist_id: '999' },
        created_at: '2026-08-13T09:00:00Z',
        tarefa_id: 't2',
      },
    ];
    const { client } = makeClient(
      filasPadrao(acoes, [
        { id: 't1', titulo: 'Pagar boleto' },
        { id: 't2', titulo: 'Ligar pro contador' },
      ]),
    );
    mocks.getAdminClient.mockReturnValue(client);

    const resposta = await GET();
    const body = (await resposta.json()) as {
      ultimasAcoes: Array<{
        id: string;
        acao: string;
        dados: Record<string, unknown> | null;
        tarefaTitulo: string | null;
      }>;
    };

    expect(body.ultimasAcoes).toHaveLength(2);
    expect(body.ultimasAcoes[0]).toMatchObject({
      id: 'a1',
      acao: 'todoist_sync',
      dados: { origem: 'todoist_writeback', acao: 'concluir' },
      tarefaTitulo: 'Pagar boleto',
    });
    expect(body.ultimasAcoes[1]?.tarefaTitulo).toBe('Ligar pro contador');
  });

  it('aguenta ação de sistema sem tarefa (tarefa_id NULL)', async () => {
    const acoes = [
      {
        id: 'a3',
        acao: 'todoist_sync',
        dados: { origem: 'exportacao_manual' },
        created_at: '2026-08-13T08:00:00Z',
        tarefa_id: null,
      },
    ];
    const { client } = makeClient(filasPadrao(acoes));
    mocks.getAdminClient.mockReturnValue(client);

    const resposta = await GET();
    const body = (await resposta.json()) as {
      ultimasAcoes: Array<{ tarefaId: string | null; tarefaTitulo: string | null }>;
    };

    expect(resposta.status).toBe(200);
    expect(body.ultimasAcoes[0]).toMatchObject({ tarefaId: null, tarefaTitulo: null });
  });
});
