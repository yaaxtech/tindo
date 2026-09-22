import { ErroInterno, ErroNaoEncontrado, ErroSemPermissao, ErroValidacao } from '@/lib/api/erros';
import { exigirContextoAuth } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ehEmailDono } from './harness';

/**
 * Lado servidor do Painel do Harness (rota /harness.json e server actions).
 * Separado de harness.ts porque o client de servidor usa `next/headers`,
 * que não pode entrar no bundle do navegador.
 */

/** Snapshot cru publicado (leitura pública, mesma RLS da página). */
export async function getHarnessSnapshotPublico(): Promise<unknown> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('harness_snapshot')
    .select('dados')
    .eq('id', 'singleton')
    .maybeSingle();
  if (error) throw new ErroInterno('Não foi possível ler o painel.', { cause: error });
  if (!data) throw new ErroNaoEncontrado('Ainda não há snapshot publicado.');
  return data.dados as unknown;
}

/**
 * Grava (ou troca) a resposta do dono a uma proposta do motor.
 * Confere o dono no servidor; a RLS da tabela repete a checagem no banco.
 */
export async function responderPropostaDono(alvoId: string, valor: -1 | 1): Promise<void> {
  if (!/^P-\d+$/.test(alvoId) || (valor !== 1 && valor !== -1)) {
    throw new ErroValidacao('Pedido inválido.');
  }
  const contexto = await exigirContextoAuth();
  if (!ehEmailDono(contexto.email)) throw new ErroSemPermissao('Só o dono pode responder.');

  // Tabela fora do Database gerado até a migration ser aplicada.
  const db = contexto.supabase as unknown as SupabaseClient;
  const { error } = await db
    .from('harness_respostas_dono')
    .upsert(
      { tipo: 'aprovacao', alvo_id: alvoId, valor, aplicado_em: null },
      { onConflict: 'tipo,alvo_id' },
    );
  if (error) throw new ErroInterno('Não consegui salvar. Tente de novo.', { cause: error });
}
