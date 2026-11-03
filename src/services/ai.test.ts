// @vitest-environment node

/**
 * classificarBatch — o lote vira UMA chamada à API, e falha fica localizada por item.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('@/lib/ai/cliente-claude', () => ({
  criarClienteClaude: () => ({ messages: { create: mocks.create } }),
}));

import { classificarBatch } from './ai';

const tarefas = [
  { id: 't1', titulo: 'Pagar conta' },
  { id: 't2', titulo: 'Ligar pro cliente' },
  { id: 't3', titulo: 'Revisar relatório' },
];

const classificacao = (id: string) => ({
  id,
  importancia: 80,
  urgencia: 50,
  facilidade: 30,
  tags_sugeridas: [],
  explicacao: 'ok',
});

const respostaLote = (ids: string[]) => ({
  content: [
    {
      type: 'tool_use',
      name: 'classificar_lote',
      input: { classificacoes: ids.map(classificacao) },
    },
  ],
  usage: { input_tokens: 300, output_tokens: 90 },
});

describe('classificarBatch', () => {
  beforeEach(() => {
    mocks.create.mockReset();
  });

  it('faz 1 chamada à API para 3 tarefas', async () => {
    mocks.create.mockResolvedValue(respostaLote(['t1', 't2', 't3']));

    const { resultados } = await classificarBatch(tarefas, { apiKey: 'k' });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(resultados).toHaveLength(3);
    expect(resultados.every((r) => r.classificacao && !r.erro)).toBe(true);
  });

  it('item ausente na resposta vira erro só dele', async () => {
    mocks.create.mockResolvedValue(respostaLote(['t1', 't3']));

    const { resultados } = await classificarBatch(tarefas, { apiKey: 'k' });

    expect(resultados.find((r) => r.id === 't1')?.classificacao).toBeDefined();
    expect(resultados.find((r) => r.id === 't3')?.classificacao).toBeDefined();
    expect(resultados.find((r) => r.id === 't2')).toEqual({
      id: 't2',
      erro: 'Item ausente na resposta da IA',
    });
  });

  it('falha da API marca todos os itens com a mesma mensagem', async () => {
    mocks.create.mockRejectedValue(new Error('API fora do ar'));

    const { resultados } = await classificarBatch(tarefas, { apiKey: 'k' });

    expect(resultados).toEqual(tarefas.map((t) => ({ id: t.id, erro: 'API fora do ar' })));
  });
});
