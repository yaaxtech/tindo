import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import type { TablesUpdate } from '@/types/database';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = rotaApi('GET /api/espacos-trabalho', async () => {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const { data, error } = await admin
    .from('espacos_trabalho')
    .select('id, todoist_id, nome, ordem_prioridade, ativo')
    .eq('usuario_id', usuarioId)
    .is('deleted_at', null)
    .order('ordem_prioridade', { ascending: true });
  if (error) throw error;
  return respostaOk({ espacos: data ?? [] });
});

interface UpdatePayload {
  espacos: Array<{ id: string; ordem_prioridade?: number; ativo?: boolean }>;
}

export const PATCH = rotaApi('PATCH /api/espacos-trabalho', async (request: NextRequest) => {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const body = (await request.json()) as UpdatePayload;

  for (const e of body.espacos) {
    const patch: TablesUpdate<'espacos_trabalho'> = {};
    if (e.ordem_prioridade !== undefined) patch.ordem_prioridade = e.ordem_prioridade;
    if (e.ativo !== undefined) patch.ativo = e.ativo;
    if (Object.keys(patch).length === 0) continue;
    const { error } = await admin
      .from('espacos_trabalho')
      .update(patch)
      .eq('id', e.id)
      .eq('usuario_id', usuarioId);
    if (error) throw error;
  }

  return respostaOk({ ok: true, atualizados: body.espacos.length });
});
