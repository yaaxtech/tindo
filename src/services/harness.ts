import { createClient } from '@/lib/supabase/client';
import type { GithubRunLinha, HarnessBlob, HarnessSnapshot } from '@/types/harness';

/**
 * Lê o snapshot singleton do Painel do Harness.
 * Retorna null quando ainda não houve nenhum empurrão (tabela vazia) ou erro.
 */
export async function getHarnessSnapshot(): Promise<HarnessSnapshot | null> {
  const supabase = createClient();
  // harness_snapshot ainda não está no Database gerado; roda `bun run db:types`
  // após aplicar a migration em prod para remover o cast.
  // biome-ignore lint/suspicious/noExplicitAny: tabela fora do Database tipado por ora
  const { data, error } = await (supabase as any)
    .from('harness_snapshot')
    .select('dados, gerado_em')
    .eq('id', 'singleton')
    .maybeSingle();

  if (error || !data) return null;
  return { dados: data.dados as HarnessBlob, geradoEm: data.gerado_em as string };
}

/**
 * Lê os tempos crus do GitHub Actions dos últimos `dias`.
 * Tabela ainda vazia (antes da 1ª coleta) ou erro → `[]`, nunca throw: o bloco
 * do painel precisa mostrar estado vazio, não quebrar a página.
 */
export async function getGithubRuns(dias = 90): Promise<GithubRunLinha[]> {
  const supabase = createClient();
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  // harness_github_runs ainda não está no Database gerado; roda `bun run db:types`
  // após aplicar a migration em prod para remover o cast.
  // biome-ignore lint/suspicious/noExplicitAny: tabela fora do Database tipado por ora
  const { data, error } = await (supabase as any)
    .from('harness_github_runs')
    .select(
      'run_id, repo, evento, branch, head_sha, conclusao, criado_em, iniciado_em, ' +
        'atualizado_em, pr_numero, pr_criado_em, pr_merged_em',
    )
    .gte('criado_em', desde)
    .order('criado_em', { ascending: false })
    // PostgREST trunca em 1000 mesmo com limite maior — ver src/services/CLAUDE.md.
    .limit(1000);

  if (error || !data) return [];
  return data as GithubRunLinha[];
}
