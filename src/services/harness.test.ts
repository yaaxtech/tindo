// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Resposta = { data?: unknown; error?: { message: string } | null };

const mocks = vi.hoisted(() => ({
  porTabela: {} as Record<string, Resposta>,
}));

// Builder mínimo do PostgREST: todo método encadeia e o `await` (ou
// `.maybeSingle()`) resolve com a resposta configurada para a tabela.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (tabela: string) => {
      const resposta = mocks.porTabela[tabela] ?? { data: null, error: null };
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gte', 'in', 'order', 'limit', 'range']) b[m] = () => b;
      b.maybeSingle = () => Promise.resolve(resposta);
      // biome-ignore lint/suspicious/noThenProperty: imita o builder thenable do PostgREST
      b.then = (ok: (r: Resposta) => unknown, falha?: (e: unknown) => unknown) =>
        Promise.resolve(resposta).then(ok, falha);
      return b;
    },
  }),
}));

import {
  getActionsSnapshot,
  getGithubRuns,
  getHarnessAlertas,
  getHarnessSnapshot,
} from './harness';

const erroSupabase = { message: 'permission denied for table' };

beforeEach(() => {
  mocks.porTabela = {};
});

describe('services/harness — erro real rejeita, vazio legítimo resolve vazio', () => {
  it('getHarnessSnapshot: tabela vazia → null; erro → throw', async () => {
    mocks.porTabela.harness_snapshot = { data: null, error: null };
    await expect(getHarnessSnapshot()).resolves.toBeNull();

    mocks.porTabela.harness_snapshot = { data: null, error: erroSupabase };
    await expect(getHarnessSnapshot()).rejects.toThrow(/snapshot.*permission denied/);
  });

  it('getHarnessSnapshot: com linha, devolve dados e geradoEm', async () => {
    mocks.porTabela.harness_snapshot = {
      data: { dados: { gerado_em: 'x' }, gerado_em: '2026-09-07T10:00:00Z' },
      error: null,
    };
    await expect(getHarnessSnapshot()).resolves.toEqual({
      dados: { gerado_em: 'x' },
      geradoEm: '2026-09-07T10:00:00Z',
    });
  });

  it('getActionsSnapshot: tabela vazia → null; erro → throw (não engole mais)', async () => {
    mocks.porTabela.harness_actions_snapshot = { data: null, error: null };
    await expect(getActionsSnapshot()).resolves.toBeNull();

    mocks.porTabela.harness_actions_snapshot = { data: null, error: erroSupabase };
    await expect(getActionsSnapshot()).rejects.toThrow(/actions_snapshot/);
  });

  it('getGithubRuns: sem linhas → []; erro → throw', async () => {
    mocks.porTabela.harness_github_runs = { data: [], error: null };
    await expect(getGithubRuns()).resolves.toEqual([]);

    mocks.porTabela.harness_github_runs = { data: null, error: erroSupabase };
    await expect(getGithubRuns()).rejects.toThrow(/github_runs/);
  });

  it('getGithubRuns: pagina além de 1000 e preserva o carimbo de coleta', async () => {
    const primeira = Array.from({ length: 1000 }, (_, i) => ({
      run_id: 2000 - i,
      repo: 'yaaxtech/tindo',
      evento: 'push',
      branch: 'main',
      head_sha: null,
      conclusao: 'success',
      criado_em: '2026-09-08T12:00:00Z',
      iniciado_em: null,
      atualizado_em: null,
      pr_numero: null,
      pr_criado_em: null,
      pr_merged_em: null,
      coletado_em: '2026-09-09T12:00:00Z',
    }));
    const segunda = [{ ...primeira[0], run_id: 1 }];
    // O mock deste arquivo devolve a mesma resposta para toda página; trocar a
    // lista entre as duas leituras mantém o teste focado no caminho de paginação.
    let chamadas = 0;
    mocks.porTabela.harness_github_runs = {
      get data() {
        chamadas += 1;
        return chamadas === 1 ? primeira : segunda;
      },
      error: null,
    };
    const linhas = await getGithubRuns();
    expect(linhas).toHaveLength(1001);
    expect(linhas[0]?.coletado_em).toBe('2026-09-09T12:00:00Z');
  });

  it('getHarnessAlertas: sem avaliações → listas vazias; erro em qualquer consulta → throw', async () => {
    mocks.porTabela.harness_avaliacoes = { data: [], error: null };
    await expect(getHarnessAlertas()).resolves.toEqual({ avaliacoes: [], alertas: [] });

    mocks.porTabela.harness_avaliacoes = { data: null, error: erroSupabase };
    await expect(getHarnessAlertas()).rejects.toThrow(/avaliacoes/);

    mocks.porTabela.harness_avaliacoes = {
      data: [{ id: 'a1', avaliado_em: 't', motivo: 'm', janela_dias: 7, violacoes_n: 1 }],
      error: null,
    };
    mocks.porTabela.harness_alertas = { data: null, error: erroSupabase };
    await expect(getHarnessAlertas()).rejects.toThrow(/alertas/);
  });

  it('getHarnessAlertas: normaliza numeric (string) para número', async () => {
    mocks.porTabela.harness_avaliacoes = {
      data: [{ id: 'a1', avaliado_em: 't', motivo: 'm', janela_dias: 7, violacoes_n: 1 }],
      error: null,
    };
    mocks.porTabela.harness_alertas = {
      data: [
        {
          id: 'x',
          avaliacao_id: 'a1',
          avaliado_em: 't',
          codigo: 'ok1',
          severidade: 'warn',
          valor: '0.75',
          limiar: '0.8',
          amostra: 10,
        },
      ],
      error: null,
    };
    const r = await getHarnessAlertas();
    expect(r.alertas[0]?.valor).toBe(0.75);
    expect(r.alertas[0]?.limiar).toBe(0.8);
  });
});
