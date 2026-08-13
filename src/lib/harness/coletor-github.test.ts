import type { GithubRunLinha } from '@/types/harness';
import { describe, expect, it } from 'vitest';
import { coletarRunsGithub, normalizar, resumoColeta } from './coletor-github';

const AGORA = Date.parse('2026-08-13T12:00:00Z');
const iso = (diasAtras: number) => new Date(AGORA - diasAtras * 864e5).toISOString();

const runApi = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  event: 'pull_request',
  head_branch: 'feat/x',
  head_sha: 'sha-a',
  conclusion: 'success',
  created_at: iso(1),
  run_started_at: iso(1),
  updated_at: iso(1),
  pull_requests: [{ number: 50 }],
  ...extra,
});

const prApi = (extra: Record<string, unknown> = {}) => ({
  number: 50,
  created_at: iso(2),
  merged_at: iso(1),
  updated_at: iso(1),
  head: { sha: 'sha-a' },
  ...extra,
});

/** Destino em memória, no lugar do Supabase. */
function destinoFake() {
  const gravadas: GithubRunLinha[] = [];
  return {
    gravadas,
    async upsert(linhas: GithubRunLinha[]) {
      gravadas.push(...linhas);
      return { erro: null };
    },
  };
}

/** fetch falso: responde por padrão de URL, contando as chamadas. */
function fetchFake(mapa: { runs: unknown[][]; pulls: unknown[][] }) {
  const chamadas: string[] = [];
  const impl = (async (url: string) => {
    chamadas.push(url);
    const pagina = Number(new URL(url).searchParams.get('page') ?? '1');
    const ehRuns = url.includes('/actions/runs');
    const corpo = ehRuns
      ? { workflow_runs: mapa.runs[pagina - 1] ?? [] }
      : (mapa.pulls[pagina - 1] ?? []);
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => corpo,
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, chamadas };
}

describe('normalizar', () => {
  it('casa run e PR por head_sha e não guarda texto livre', () => {
    const [linha] = normalizar('yaaxtech/tindo', [runApi()] as never, [prApi()] as never);
    expect(linha).toMatchObject({
      run_id: 1,
      repo: 'yaaxtech/tindo',
      evento: 'pull_request',
      head_sha: 'sha-a',
      pr_numero: 50,
    });
    expect(linha?.pr_merged_em).toBe(iso(1));
    // Nenhuma chave de texto livre do GitHub sobrevive à normalização.
    const chaves = Object.keys(linha ?? {});
    expect(chaves).not.toContain('title');
    expect(chaves).not.toContain('head_commit');
  });

  it('cai no número do array pull_requests quando o SHA não bate', () => {
    const [linha] = normalizar(
      'yaaxtech/tindo',
      [runApi({ head_sha: 'sha-rebase' })] as never,
      [prApi({ head: { sha: 'outro' } })] as never,
    );
    expect(linha?.pr_numero).toBe(50);
    expect(linha?.pr_merged_em).toBe(iso(1));
  });

  it('descarta eventos que não são pull_request nem push', () => {
    const linhas = normalizar(
      'yaaxtech/tindo',
      [
        runApi({ event: 'schedule' }),
        runApi({ id: 2, event: 'push', head_branch: 'main' }),
      ] as never,
      [] as never,
    );
    expect(linhas.map((l) => l.run_id)).toEqual([2]);
  });

  it('run sem PR fica com os campos de PR nulos', () => {
    const [linha] = normalizar(
      'yaaxtech/tindo',
      [runApi({ event: 'push', head_branch: 'main', pull_requests: [] })] as never,
      [] as never,
    );
    expect(linha?.pr_numero).toBeNull();
    expect(linha?.pr_merged_em).toBeNull();
  });
});

describe('coletarRunsGithub', () => {
  it('grava os runs da janela e reporta que rodou sem token', async () => {
    const destino = destinoFake();
    const { impl } = fetchFake({ runs: [[runApi()]], pulls: [[prApi()]] });
    const r = await coletarRunsGithub(destino, {
      repos: ['yaaxtech/tindo'],
      token: null,
      agora: AGORA,
      fetchImpl: impl,
    });
    expect(r.gravados).toBe(1);
    expect(r.comToken).toBe(false);
    expect(r.parcial).toBeNull();
    expect(destino.gravadas).toHaveLength(1);
    expect(resumoColeta(r)).toContain('sem GITHUB_TOKEN');
  });

  it('para de paginar ao passar dos 90 dias', async () => {
    const destino = destinoFake();
    const primeira = Array.from({ length: 100 }, (_, i) => runApi({ id: i + 1 }));
    const segunda = [runApi({ id: 999, created_at: iso(200) })];
    const { impl, chamadas } = fetchFake({
      runs: [primeira, segunda, [runApi({ id: 1000 })]],
      pulls: [[]],
    });
    const r = await coletarRunsGithub(destino, {
      repos: ['yaaxtech/tindo'],
      token: null,
      agora: AGORA,
      fetchImpl: impl,
    });
    expect(r.gravados).toBe(100);
    expect(chamadas.filter((u) => u.includes('/actions/runs'))).toHaveLength(2);
    expect(destino.gravadas.map((l) => l.run_id)).not.toContain(999);
  });

  it('rate limit não lança: grava o que veio e marca parcial', async () => {
    const destino = destinoFake();
    const impl = (async () =>
      ({
        ok: false,
        status: 403,
        headers: new Headers({ 'x-ratelimit-remaining': '0' }),
        json: async () => ({}),
      }) as unknown as Response) as unknown as typeof fetch;

    const r = await coletarRunsGithub(destino, {
      repos: ['yaaxtech/tindo'],
      token: null,
      agora: AGORA,
      fetchImpl: impl,
    });
    expect(r.gravados).toBe(0);
    expect(r.parcial).toContain('limite de requisições');
    expect(resumoColeta(r)).toContain('parcial');
  });

  it('falha de rede em um repo não impede os demais', async () => {
    const destino = destinoFake();
    const impl = (async (url: string) => {
      if (url.includes('quebrado')) throw new Error('rede fora');
      const ehRuns = url.includes('/actions/runs');
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => (ehRuns ? { workflow_runs: [runApi()] } : [prApi()]),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const r = await coletarRunsGithub(destino, {
      repos: ['dono/quebrado', 'yaaxtech/tindo'],
      token: 'tok',
      agora: AGORA,
      fetchImpl: impl,
    });
    expect(r.gravados).toBe(1);
    expect(r.parcial).toContain('rede fora');
    expect(r.comToken).toBe(true);
  });
});
