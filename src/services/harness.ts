import { createClient } from '@/lib/supabase/client';
import type { HarnessBlob, HarnessSnapshot } from '@/types/harness';

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
