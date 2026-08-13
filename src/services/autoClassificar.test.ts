// @vitest-environment node

/**
 * Testes de autoClassificar — foco no log em historico_acoes.
 *
 * O insert que existia aqui mandava a coluna `tipo` (inexistente) e sempre falhou
 * em silêncio. Estes testes fixam o contrato do log: coluna `acao`, valor
 * 'ai_auto_classificada' (nunca 'editada', que alimentaria a taxaReavaliacao) e
 * `dados.origem` preenchido.
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
  classificarTarefa: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: mocks.getAdminClient,
}));

vi.mock('./ai', () => ({
  classificarTarefa: mocks.classificarTarefa,
}));

import { autoClassificarSeHabilitado } from './autoClassificar';

/** Builder fluente awaitable que registra insert/update/upsert. */
function makeBuilder(tabela: string, result: FakeResult, ops: Operacao[]) {
  // biome-ignore lint/suspicious/noExplicitAny: builder fake dinâmico
  const builder: Record<string, any> = {};

  // biome-ignore lint/suspicious/noThenProperty: thenable intencional (simula o query builder)
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  builder.catch = (reject: (e: unknown) => unknown) => Promise.resolve(result).catch(reject);
  builder.finally = (fn: () => void) => Promise.resolve(result).finally(fn);

  for (const m of ['select', 'eq', 'neq', 'is', 'in', 'not', 'order', 'limit', 'maybeSingle']) {
    builder[m] = () => builder;
  }
  for (const m of ['insert', 'update', 'upsert']) {
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

  const client = {
    from: vi.fn((tabela: string) => {
      const idx = contadores[tabela] ?? 0;
      contadores[tabela] = idx + 1;
      const result = filas[tabela]?.[idx] ?? { data: [], error: null };
      return makeBuilder(tabela, result, ops);
    }),
  };

  return { client, ops };
}

const CONFIG_OK = {
  ai_habilitado: true,
  ai_auto_aceita_classificacao: true,
  ai_api_key_criptografada: 'chave-fake',
  ai_modelo: 'claude-fake',
  criterios_sucesso: null,
  peso_urgencia: 0.4,
  peso_importancia: 0.4,
  peso_facilidade: 0.2,
};

const TAREFA = {
  id: 'tarefa-1',
  usuario_id: 'usuario-1',
  titulo: 'Comprar café',
  descricao: null,
  importancia: null,
  urgencia: null,
  facilidade: null,
  tipo: 'tarefa',
  prioridade: 4,
  data_vencimento: null,
  prazo_conclusao: null,
  projeto_id: null,
};

function clientFeliz(historicoResult: FakeResult = { error: null }) {
  return makeClient({
    configuracoes: [{ data: CONFIG_OK, error: null }],
    tarefas: [{ data: TAREFA, error: null }, { error: null }],
    projetos: [{ data: [], error: null }],
    tags: [{ data: [], error: null }],
    tarefa_tags: [{ data: [], error: null }],
    sugestoes_ai: [{ error: null }],
    historico_acoes: [historicoResult],
  });
}

describe('autoClassificarSeHabilitado — log em historico_acoes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.classificarTarefa.mockResolvedValue({
      importancia: 7,
      urgencia: 5,
      facilidade: 8,
      tags_sugeridas: [],
    });
  });

  it('registra a classificação automática com acao=ai_auto_classificada', async () => {
    const { client, ops } = clientFeliz();
    mocks.getAdminClient.mockReturnValue(client);

    const resultado = await autoClassificarSeHabilitado({
      tarefaId: 'tarefa-1',
      usuarioId: 'usuario-1',
    });

    expect(resultado.pulada).toBe(false);

    const log = ops.find((o) => o.tabela === 'historico_acoes' && o.metodo === 'insert');
    expect(log).toBeDefined();
    expect(log?.payload).toEqual({
      usuario_id: 'usuario-1',
      tarefa_id: 'tarefa-1',
      acao: 'ai_auto_classificada',
      dados: { origem: 'ai_auto_classificacao' },
    });
  });

  it('nunca grava como editada (não pode virar reavaliação humana na taxaReavaliacao)', async () => {
    const { client, ops } = clientFeliz();
    mocks.getAdminClient.mockReturnValue(client);

    await autoClassificarSeHabilitado({ tarefaId: 'tarefa-1', usuarioId: 'usuario-1' });

    const acoes = ops
      .filter((o) => o.tabela === 'historico_acoes')
      .map((o) => (o.payload as { acao: string }).acao);
    expect(acoes).not.toContain('editada');
  });

  it('não gera log quando a classificação é pulada', async () => {
    const { client, ops } = makeClient({
      configuracoes: [{ data: { ...CONFIG_OK, ai_habilitado: false }, error: null }],
    });
    mocks.getAdminClient.mockReturnValue(client);

    const resultado = await autoClassificarSeHabilitado({
      tarefaId: 'tarefa-1',
      usuarioId: 'usuario-1',
    });

    expect(resultado.pulada).toBe(true);
    expect(ops.filter((o) => o.tabela === 'historico_acoes')).toHaveLength(0);
  });

  it('erro no log não derruba a classificação, mas é reportado no console', async () => {
    const { client } = clientFeliz({ error: { message: 'boom' } });
    mocks.getAdminClient.mockReturnValue(client);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const resultado = await autoClassificarSeHabilitado({
      tarefaId: 'tarefa-1',
      usuarioId: 'usuario-1',
    });

    expect(resultado.pulada).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
