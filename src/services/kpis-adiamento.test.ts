/**
 * Testes unitários para kpis-adiamento.ts.
 *
 * Estratégia de mock:
 *   Cada teste constrói um `makeClient(...)` com os resultados esperados
 *   e passa o mock como primeiro argumento de `calcularKpisAdiamento`.
 *   Não há vi.mock de módulos — o client é injetado via DI.
 *
 * Padrão de spy: como o Supabase client usa fluent-builder (encadeamento),
 * cada método do builder retorna o mesmo objeto spy. O último método da
 * cadeia (maybeSingle, order + limit, etc.) resolve o valor.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calcularKpisAdiamento } from './kpis-adiamento';

// ---------------------------------------------------------------------------
// Factory de builder Supabase fake
// ---------------------------------------------------------------------------

type FakeResult = { data?: unknown; error?: unknown; count?: number | null };

/**
 * Cria um builder fluente que responde a qualquer encadeamento e,
 * ao ser awaited, resolve com `result`.
 *
 * Implementação: cada método builder retorna um objeto com `then` definido
 * explicitamente como função (thenable nativo), mais todos os métodos do
 * query builder como funções que retornam `this`. Isso evita o problema de
 * Proxy onde `then` não é chamado no receiver correto.
 */
function makeBuilder(result: FakeResult) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: Record<string, any> = {};

  // Faz o builder ser awaitable retornando o resultado.
  // biome-ignore lint/suspicious/noThenProperty: thenable intencional para simular Supabase query builder
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    return Promise.resolve(result).then(resolve, reject);
  };
  builder.catch = (reject: (e: unknown) => unknown) => Promise.resolve(result).catch(reject);
  builder.finally = (fn: () => void) => Promise.resolve(result).finally(fn);

  // Todos os métodos do query builder que podem aparecer na cadeia
  const methods = [
    'select',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'is',
    'not',
    'in',
    'filter',
    'or',
    'and',
    'order',
    'limit',
    'range',
    'single',
    'maybeSingle',
    'insert',
    'update',
    'upsert',
    'delete',
  ];

  for (const m of methods) {
    builder[m] = () => builder; // encadeia de volta para si mesmo
  }

  return builder;
}

/**
 * makeClient recebe um mapa de sequência de chamadas `from`.
 * Cada entry é um array de resultados a serem retornados em ordem
 * para aquela tabela. Se a tabela não estiver no mapa, retorna { data: [], error: null }.
 */
function makeClient(calls: Record<string, FakeResult[]>) {
  const counters: Record<string, number> = {};

  return {
    from: vi.fn((table: string) => {
      const queue = calls[table] ?? [];
      const idx = counters[table] ?? 0;
      counters[table] = idx + 1;
      const result = queue[idx] ?? { data: [], error: null };
      return makeBuilder(result);
    }),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoValido(s: string): boolean {
  return !Number.isNaN(Date.parse(s));
}

// ---------------------------------------------------------------------------
// TRA — Taxa Re-adiamento
// ---------------------------------------------------------------------------

describe('calcularKpisAdiamento — TRA', () => {
  beforeEach(() => vi.clearAllMocks());

  it('0 amostras → valor=0, dentroDaMeta=true', async () => {
    const client = makeClient({
      historico_acoes: [
        { data: [], error: null }, // acoesAuto
      ],
      tarefas: [
        { data: [], error: null }, // tarefasComPrazo
        { data: [], error: null }, // tarefasComVencimento
        { data: [], error: null }, // concluidasData
        { data: null, error: null, count: 0 }, // SAE total
        { data: null, error: null, count: 0 }, // SAE escapando
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await calcularKpisAdiamento(client as any, 'uid-1');
    expect(resultado.tra.valor).toBe(0);
    expect(resultado.tra.amostras).toBe(0);
    expect(resultado.tra.dentroDaMeta).toBe(true);
  });

  it('2 de 4 re-adiamentos → 50% → dentroDaMeta=false', async () => {
    // 4 ações adiada_auto; 2 têm próxima ação = adiada_auto (re-adiamento)
    const acoesAuto = [
      { id: '1', tarefa_id: 'ta', created_at: '2026-04-01T10:00:00Z' },
      { id: '2', tarefa_id: 'tb', created_at: '2026-04-02T10:00:00Z' },
      { id: '3', tarefa_id: 'tc', created_at: '2026-04-03T10:00:00Z' },
      { id: '4', tarefa_id: 'td', created_at: '2026-04-04T10:00:00Z' },
    ];

    // proximas: 2 re-adiamentos, 1 conclusão, 1 null (skip)
    const proximasAcoes = [
      { data: { acao: 'adiada_auto' }, error: null }, // ta → re-adiamento
      { data: { acao: 'adiada_manual' }, error: null }, // tb → re-adiamento
      { data: { acao: 'concluida' }, error: null }, // tc → conclusão
      { data: null, error: null }, // td → null (skip)
    ];

    const client = makeClient({
      historico_acoes: [{ data: acoesAuto, error: null }, ...proximasAcoes],
      tarefas: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: null, error: null, count: 0 },
        { data: null, error: null, count: 0 },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await calcularKpisAdiamento(client as any, 'uid-1');
    expect(resultado.tra.amostras).toBe(4);
    expect(resultado.tra.valor).toBeCloseTo(50);
    expect(resultado.tra.dentroDaMeta).toBe(false); // 50% ≥ meta 25%
  });
});

// ---------------------------------------------------------------------------
// TCA — Taxa Conclusão pós-auto
// ---------------------------------------------------------------------------

describe('calcularKpisAdiamento — TCA', () => {
  beforeEach(() => vi.clearAllMocks());

  it('3 de 4 concluídos → 75% → dentroDaMeta=true', async () => {
    const acoesAuto = [
      { id: '1', tarefa_id: 'ta', created_at: '2026-04-01T10:00:00Z' },
      { id: '2', tarefa_id: 'tb', created_at: '2026-04-02T10:00:00Z' },
      { id: '3', tarefa_id: 'tc', created_at: '2026-04-03T10:00:00Z' },
      { id: '4', tarefa_id: 'td', created_at: '2026-04-04T10:00:00Z' },
    ];

    const client = makeClient({
      historico_acoes: [
        { data: acoesAuto, error: null },
        { data: { acao: 'concluida' }, error: null },
        { data: { acao: 'concluida' }, error: null },
        { data: { acao: 'concluida' }, error: null },
        { data: { acao: 'adiada_auto' }, error: null },
      ],
      tarefas: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: null, error: null, count: 0 },
        { data: null, error: null, count: 0 },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await calcularKpisAdiamento(client as any, 'uid-1');
    expect(resultado.tca.amostras).toBe(4);
    expect(resultado.tca.valor).toBeCloseTo(75);
    expect(resultado.tca.dentroDaMeta).toBe(true); // 75% > meta 50%
  });
});

// ---------------------------------------------------------------------------
// TEX — Taxa Expiração
// ---------------------------------------------------------------------------

describe('calcularKpisAdiamento — TEX', () => {
  beforeEach(() => vi.clearAllMocks());

  it('1 de 20 expirada → 5% → dentroDaMeta=false (meta <5%)', async () => {
    // 20 tarefas: 1 com adiada_ate > prazo_conclusao (expirada), 19 OK
    const tarefasComPrazo = Array.from({ length: 20 }, (_, i) => ({
      id: `t${i}`,
      // expirada: adiada_ate > prazo_conclusao
      adiada_ate: i === 0 ? '2026-05-01T00:00:00Z' : '2026-04-25T00:00:00Z',
      prazo_conclusao: i === 0 ? '2026-04-28T00:00:00Z' : '2026-04-30T00:00:00Z',
      data_vencimento: null,
    }));

    const client = makeClient({
      historico_acoes: [
        { data: [], error: null }, // acoesAuto vazia
      ],
      tarefas: [
        { data: tarefasComPrazo, error: null }, // tarefasComPrazo
        { data: [], error: null }, // tarefasComVencimento
        { data: [], error: null }, // concluidasData
        { data: null, error: null, count: 0 }, // SAE total
        { data: null, error: null, count: 0 }, // SAE escapando
      ],
    });

    // Injeta `agora` simulando data fixa — como calcularKpisAdiamento usa `new Date()` internamente,
    // verificamos apenas as proporções (que independem de agora).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await calcularKpisAdiamento(client as any, 'uid-1', 30);
    expect(resultado.tex.amostras).toBe(20);
    expect(resultado.tex.valor).toBeCloseTo(5);
    expect(resultado.tex.dentroDaMeta).toBe(false); // 5% NÃO é < 5%
  });

  it('0 amostras → valor=0, dentroDaMeta=true', async () => {
    const client = makeClient({
      historico_acoes: [{ data: [], error: null }],
      tarefas: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: null, error: null, count: 0 },
        { data: null, error: null, count: 0 },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await calcularKpisAdiamento(client as any, 'uid-1');
    expect(resultado.tex.valor).toBe(0);
    expect(resultado.tex.dentroDaMeta).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MAC — Mediana adiamentos/concluída
// ---------------------------------------------------------------------------

describe('calcularKpisAdiamento — MAC', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mediana de [1,2,3,4,5] → 3 → dentroDaMeta=true', async () => {
    const concluidas = [1, 2, 3, 4, 5].map((n) => ({ adiamento_count: n }));

    const client = makeClient({
      historico_acoes: [{ data: [], error: null }],
      tarefas: [
        { data: [], error: null },
        { data: [], error: null },
        { data: concluidas, error: null },
        { data: null, error: null, count: 0 },
        { data: null, error: null, count: 0 },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await calcularKpisAdiamento(client as any, 'uid-1');
    expect(resultado.mac.valor).toBe(3);
    expect(resultado.mac.amostras).toBe(5);
    expect(resultado.mac.dentroDaMeta).toBe(true); // 3 ≤ meta 3
  });

  it('mediana de [4,5,6] → 5 → dentroDaMeta=false', async () => {
    const concluidas = [4, 5, 6].map((n) => ({ adiamento_count: n }));

    const client = makeClient({
      historico_acoes: [{ data: [], error: null }],
      tarefas: [
        { data: [], error: null },
        { data: [], error: null },
        { data: concluidas, error: null },
        { data: null, error: null, count: 0 },
        { data: null, error: null, count: 0 },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await calcularKpisAdiamento(client as any, 'uid-1');
    expect(resultado.mac.valor).toBe(5);
    expect(resultado.mac.dentroDaMeta).toBe(false); // 5 > meta 3
  });
});

// ---------------------------------------------------------------------------
// SAE — Score-alto-escapando
// ---------------------------------------------------------------------------

describe('calcularKpisAdiamento — SAE', () => {
  beforeEach(() => vi.clearAllMocks());

  it('0 de 10 escapando → 0% → dentroDaMeta=true', async () => {
    const client = makeClient({
      historico_acoes: [{ data: [], error: null }],
      tarefas: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: null, error: null, count: 10 }, // SAE total
        { data: null, error: null, count: 0 }, // SAE escapando
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await calcularKpisAdiamento(client as any, 'uid-1');
    expect(resultado.sae.amostras).toBe(10);
    expect(resultado.sae.valor).toBe(0);
    expect(resultado.sae.dentroDaMeta).toBe(true); // 0% ≤ meta 2%
  });

  it('3 de 10 escapando → 30% → dentroDaMeta=false', async () => {
    const client = makeClient({
      historico_acoes: [{ data: [], error: null }],
      tarefas: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: null, error: null, count: 10 }, // SAE total
        { data: null, error: null, count: 3 }, // SAE escapando
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await calcularKpisAdiamento(client as any, 'uid-1');
    expect(resultado.sae.valor).toBeCloseTo(30);
    expect(resultado.sae.dentroDaMeta).toBe(false); // 30% > meta 2%
  });
});

// ---------------------------------------------------------------------------
// janelaDias e calculadoEm
// ---------------------------------------------------------------------------

describe('calcularKpisAdiamento — janelaDias e calculadoEm', () => {
  beforeEach(() => vi.clearAllMocks());

  const clientVazio = () =>
    makeClient({
      historico_acoes: [{ data: [], error: null }],
      tarefas: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: null, error: null, count: 0 },
        { data: null, error: null, count: 0 },
      ],
    });

  it('janelaDias default é 30', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await calcularKpisAdiamento(clientVazio() as any, 'uid-1');
    expect(resultado.janelaDias).toBe(30);
  });

  it('janelaDias custom (7)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await calcularKpisAdiamento(clientVazio() as any, 'uid-1', 7);
    expect(resultado.janelaDias).toBe(7);
  });

  it('calculadoEm é ISO string válida', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await calcularKpisAdiamento(clientVazio() as any, 'uid-1');
    expect(isoValido(resultado.calculadoEm)).toBe(true);
  });
});
