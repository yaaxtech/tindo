import { createClient } from '@/lib/supabase/client';
import type { GithubRunLinha, HarnessBlob, HarnessSnapshot } from '@/types/harness';

/**
 * Lê o snapshot singleton do Painel do Harness.
 * Retorna null quando ainda não houve nenhum empurrão (tabela vazia) ou erro.
 */
export async function getHarnessSnapshot(): Promise<HarnessSnapshot | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('harness_snapshot')
    .select('dados, gerado_em')
    .eq('id', 'singleton')
    .maybeSingle();

  if (error || !data) return null;
  // `dados` é jsonb livre — o formato do blob é contrato do publicar-painel.mjs.
  return { dados: data.dados as unknown as HarnessBlob, geradoEm: data.gerado_em };
}

/**
 * Lê os tempos crus do GitHub Actions dos últimos `dias`.
 * Tabela ainda vazia (antes da 1ª coleta) ou erro → `[]`, nunca throw: o bloco
 * do painel precisa mostrar estado vazio, não quebrar a página.
 */
export async function getGithubRuns(dias = 90): Promise<GithubRunLinha[]> {
  const supabase = createClient();
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const { data, error } = await supabase
    .from('harness_github_runs')
    // Uma string literal só: concatenar com `+` impede o supabase-js de inferir
    // as colunas e o retorno degrada para `GenericStringError[]`.
    .select(`
      run_id, repo, evento, branch, head_sha, conclusao, criado_em, iniciado_em,
      atualizado_em, pr_numero, pr_criado_em, pr_merged_em
    `)
    .gte('criado_em', desde)
    .order('criado_em', { ascending: false })
    // PostgREST trunca em 1000 mesmo com limite maior — ver src/services/CLAUDE.md.
    .limit(1000);

  if (error || !data) return [];
  // Único ponto que ainda estreita: `evento` é varchar no banco e união fechada
  // ('pull_request' | 'push') no domínio — quem grava é o coletor-github.
  return data as GithubRunLinha[];
}
