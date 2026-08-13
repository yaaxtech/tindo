import type { GithubRunLinha } from '@/types/harness';

// Coletor dos tempos crus do GitHub Actions (passo do /api/cron/diario).
//
// Desenho: SEM parâmetro e SEM rota manual. Busca sempre os últimos 90 dias e
// faz upsert por run_id — a 1ª execução semeia os 90 dias sozinha e as
// seguintes são baratas e idempotentes. Se a API travar no meio (rate limit,
// rede), grava o que já veio e o dia seguinte completa.
//
// Economia de chamadas: NUNCA uma requisição de PR por run. São duas listagens
// paginadas (runs e PRs fechados) casadas em memória por head_sha/número.

export const REPOS_ATIVOS = ['yaaxtech/tindo'] as const;
export const DIAS_COLETA = 90;
const POR_PAGINA = 100;
const MAX_PAGINAS = 20;
const API = 'https://api.github.com';

interface RunApi {
  id: number;
  event: string;
  head_branch: string | null;
  head_sha: string | null;
  conclusion: string | null;
  created_at: string;
  run_started_at?: string | null;
  updated_at: string | null;
  pull_requests?: { number: number; head?: { sha?: string | null } | null }[] | null;
}

interface PrApi {
  number: number;
  created_at: string;
  merged_at: string | null;
  updated_at: string;
  head: { sha: string | null } | null;
}

/** Erro de coleta que não deve derrubar o cron — vira nota no resultado. */
class ColetaInterrompida extends Error {}

/**
 * Fatia mínima do client admin que o coletor usa. Interface estreita de
 * propósito: mantém a função testável sem arrastar o Database inteiro (a
 * tabela ainda não está no `src/types/database.ts` gerado).
 */
export interface DestinoRuns {
  upsert(linhas: GithubRunLinha[]): Promise<{ erro: string | null }>;
}

export interface OpcoesColeta {
  repos?: readonly string[];
  dias?: number;
  token?: string | null;
  agora?: number;
  fetchImpl?: typeof fetch;
}

export interface ResultadoColeta {
  repos: string[];
  gravados: number;
  comToken: boolean;
  /** Motivo de a coleta ter parado antes do fim, ou null se veio inteira. */
  parcial: string | null;
}

function cabecalhos(token: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'tindo-harness',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function buscarPagina<T>(
  url: string,
  token: string | null,
  fetchImpl: typeof fetch,
): Promise<T[]> {
  const res = await fetchImpl(url, { headers: cabecalhos(token) });
  if (res.status === 403 || res.status === 429) {
    const resta = res.headers.get('x-ratelimit-remaining');
    throw new ColetaInterrompida(
      resta === '0' ? 'limite de requisições do GitHub' : `GitHub respondeu ${res.status}`,
    );
  }
  if (!res.ok) throw new ColetaInterrompida(`GitHub respondeu ${res.status}`);
  return (await res.json()) as T[];
}

/** Pagina até a página vir vazia, curta, ou trazer item mais antigo que o corte. */
async function paginar<T>(
  montarUrl: (pagina: number) => string,
  maisAntigoDe: (item: T) => number,
  corte: number,
  token: string | null,
  fetchImpl: typeof fetch,
  extrair: (json: unknown) => T[] = (json) => json as T[],
): Promise<T[]> {
  const acumulado: T[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const bruto = await buscarPagina<unknown>(montarUrl(pagina), token, fetchImpl);
    const itens = extrair(bruto);
    if (itens.length === 0) break;
    let passouDoCorte = false;
    for (const item of itens) {
      if (maisAntigoDe(item) < corte) {
        passouDoCorte = true;
        continue;
      }
      acumulado.push(item);
    }
    if (passouDoCorte || itens.length < POR_PAGINA) break;
  }
  return acumulado;
}

/** Casa runs com PRs em memória e normaliza para as colunas da tabela. */
export function normalizar(repo: string, runs: RunApi[], prs: PrApi[]): GithubRunLinha[] {
  const porSha = new Map<string, PrApi>();
  const porNumero = new Map<number, PrApi>();
  for (const pr of prs) {
    porNumero.set(pr.number, pr);
    if (pr.head?.sha) porSha.set(pr.head.sha, pr);
  }

  const linhas: GithubRunLinha[] = [];
  for (const run of runs) {
    if (run.event !== 'pull_request' && run.event !== 'push') continue;
    const doRun = run.pull_requests?.[0]?.number;
    const pr =
      (run.head_sha ? porSha.get(run.head_sha) : undefined) ??
      (doRun != null ? porNumero.get(doRun) : undefined) ??
      null;
    linhas.push({
      run_id: run.id,
      repo,
      evento: run.event,
      branch: run.head_branch ?? null,
      head_sha: run.head_sha ?? null,
      conclusao: run.conclusion ?? null,
      criado_em: run.created_at,
      iniciado_em: run.run_started_at ?? null,
      atualizado_em: run.updated_at ?? null,
      pr_numero: pr?.number ?? doRun ?? null,
      pr_criado_em: pr?.created_at ?? null,
      pr_merged_em: pr?.merged_at ?? null,
    });
  }
  return linhas;
}

/**
 * Coleta os runs dos repos ativos e faz upsert por run_id.
 * Nunca lança: qualquer falha vira `parcial` no resultado.
 */
export async function coletarRunsGithub(
  destino: DestinoRuns,
  opcoes: OpcoesColeta = {},
): Promise<ResultadoColeta> {
  const {
    repos = REPOS_ATIVOS,
    dias = DIAS_COLETA,
    token = process.env.GITHUB_TOKEN ?? null,
    agora = Date.now(),
    fetchImpl = fetch,
  } = opcoes;

  const corte = agora - dias * 864e5;
  const resultado: ResultadoColeta = {
    repos: [...repos],
    gravados: 0,
    comToken: Boolean(token),
    parcial: null,
  };

  for (const repo of repos) {
    try {
      const runs = await paginar<RunApi>(
        (p) => `${API}/repos/${repo}/actions/runs?per_page=${POR_PAGINA}&page=${p}`,
        (r) => Date.parse(r.created_at),
        corte,
        token,
        fetchImpl,
        (json) => (json as { workflow_runs?: RunApi[] })?.workflow_runs ?? [],
      );
      const prs = await paginar<PrApi>(
        (p) =>
          `${API}/repos/${repo}/pulls?state=closed&sort=updated&direction=desc` +
          `&per_page=${POR_PAGINA}&page=${p}`,
        (pr) => Date.parse(pr.updated_at),
        corte,
        token,
        fetchImpl,
      );

      const linhas = normalizar(repo, runs, prs);
      if (linhas.length === 0) continue;
      const { erro } = await destino.upsert(linhas);
      if (erro) {
        resultado.parcial = `falha ao gravar ${repo}: ${erro}`;
        continue;
      }
      resultado.gravados += linhas.length;
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      resultado.parcial = `${repo}: ${motivo}`;
    }
  }

  return resultado;
}

/** Resumo de uma linha para o campo `resultados` do cron. */
export function resumoColeta(r: ResultadoColeta): string {
  const base = `${r.gravados} runs${r.comToken ? '' : ' (sem GITHUB_TOKEN, chamada anônima)'}`;
  return r.parcial ? `parcial: ${base} — ${r.parcial}` : `ok: ${base}`;
}
