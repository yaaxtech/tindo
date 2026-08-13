import { createClient } from '@/lib/supabase/client';
import type {
  AlertaLinha,
  AvaliacaoLinha,
  GithubRunLinha,
  HarnessBlob,
  HarnessSnapshot,
} from '@/types/harness';

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

/** Avaliações do revisor de KPIs + as violações que cada uma encontrou. */
export interface HistoricoAlertas {
  /** Mais recente primeiro. Vazio = revisor ainda não rodou nenhuma vez. */
  avaliacoes: AvaliacaoLinha[];
  /** Violações de TODAS as avaliações da lista — a tela conta por código. */
  alertas: AlertaLinha[];
}

/**
 * Lê as últimas `quantas` avaliações do revisor e seus alertas.
 * Traz o histórico inteiro (não só a última) de propósito: é a contagem de
 * disparos por limiar que separa alerta de barulho.
 * Erro ou tabela vazia → listas vazias, nunca throw: a faixa some, o resto do
 * painel continua de pé.
 */
export async function getHarnessAlertas(quantas = 12): Promise<HistoricoAlertas> {
  const supabase = createClient();
  const vazio: HistoricoAlertas = { avaliacoes: [], alertas: [] };

  // harness_avaliacoes/harness_alertas ainda não estão no Database gerado; roda
  // `bun run db:types` após aplicar a migration em prod para remover os casts.
  // biome-ignore lint/suspicious/noExplicitAny: tabelas fora do Database tipado por ora
  const { data: avaliacoes, error } = await (supabase as any)
    .from('harness_avaliacoes')
    .select('id, avaliado_em, motivo, janela_dias, violacoes_n')
    .order('avaliado_em', { ascending: false })
    .limit(quantas);

  if (error || !avaliacoes || avaliacoes.length === 0) return vazio;

  const ids = (avaliacoes as AvaliacaoLinha[]).map((a) => a.id);
  // biome-ignore lint/suspicious/noExplicitAny: tabelas fora do Database tipado por ora
  const { data: alertas } = await (supabase as any)
    .from('harness_alertas')
    .select('id, avaliacao_id, avaliado_em, codigo, severidade, valor, limiar, amostra')
    .in('avaliacao_id', ids)
    .order('avaliado_em', { ascending: false });

  return {
    avaliacoes: avaliacoes as AvaliacaoLinha[],
    // numeric do Postgres chega como string no PostgREST — normaliza aqui para
    // a tela nunca formatar "0.7551020408163265" achando que é número.
    alertas: ((alertas ?? []) as AlertaLinha[]).map((a) => ({
      ...a,
      valor: a.valor == null ? null : Number(a.valor),
      limiar: Number(a.limiar),
    })),
  };
}
