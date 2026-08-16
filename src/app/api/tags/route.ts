import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import type { TablesUpdate } from '@/types/database';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = rotaApi('GET /api/tags', async () => {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const { data, error } = await admin
    .from('tags')
    .select('id, todoist_id, nome, cor, tipo_peso, valor_peso, ativo')
    .eq('usuario_id', usuarioId)
    .is('deleted_at', null)
    .order('nome', { ascending: true });
  if (error) throw error;
  return respostaOk({ tags: data ?? [] });
});

interface UpdatePayload {
  tags: Array<{
    id: string;
    tipo_peso?: 'multiplicador' | 'soma' | 'subtracao' | 'percentual' | 'peso_custom';
    valor_peso?: number;
    ativo?: boolean;
  }>;
}

export const PATCH = rotaApi('PATCH /api/tags', async (request: NextRequest) => {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const body = (await request.json()) as UpdatePayload;

  for (const t of body.tags) {
    const patch: TablesUpdate<'tags'> = {};
    if (t.tipo_peso !== undefined) patch.tipo_peso = t.tipo_peso;
    if (t.valor_peso !== undefined) patch.valor_peso = t.valor_peso;
    if (t.ativo !== undefined) patch.ativo = t.ativo;
    if (Object.keys(patch).length === 0) continue;
    const { error } = await admin
      .from('tags')
      .update(patch)
      .eq('id', t.id)
      .eq('usuario_id', usuarioId);
    if (error) throw error;
  }

  return respostaOk({ ok: true, atualizados: body.tags.length });
});
