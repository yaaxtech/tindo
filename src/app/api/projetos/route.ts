import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import type { TablesUpdate } from '@/types/database';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = rotaApi('GET /api/projetos', async () => {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const { data, error } = await admin
    .from('projetos')
    .select('id, todoist_id, nome, cor, ordem_prioridade, multiplicador, ativo')
    .eq('usuario_id', usuarioId)
    .is('deleted_at', null)
    .order('ordem_prioridade', { ascending: true });
  if (error) throw error;
  return respostaOk({ projetos: data ?? [] });
});

interface UpdatePayload {
  // Array de { id, ordem_prioridade, multiplicador? }
  projetos: Array<{
    id: string;
    ordem_prioridade?: number;
    multiplicador?: number;
  }>;
}

export const PATCH = rotaApi('PATCH /api/projetos', async (request: NextRequest) => {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const body = (await request.json()) as UpdatePayload;

  for (const p of body.projetos) {
    const patch: TablesUpdate<'projetos'> = {};
    if (p.ordem_prioridade !== undefined) patch.ordem_prioridade = p.ordem_prioridade;
    if (p.multiplicador !== undefined) patch.multiplicador = p.multiplicador;
    if (Object.keys(patch).length === 0) continue;
    const { error } = await admin
      .from('projetos')
      .update(patch)
      .eq('id', p.id)
      .eq('usuario_id', usuarioId);
    if (error) throw error;
  }

  return respostaOk({ ok: true, atualizados: body.projetos.length });
});
