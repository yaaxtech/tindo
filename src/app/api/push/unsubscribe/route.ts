import { ErroValidacao } from '@/lib/api/erros';
import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

interface UnsubscribeBody {
  endpoint: string;
}

export const POST = rotaApi('POST /api/push/unsubscribe', async (request: NextRequest) => {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const body = (await request.json()) as UnsubscribeBody;

  if (!body?.endpoint) {
    throw new ErroValidacao('endpoint é obrigatório.');
  }

  const { error } = await admin
    .from('push_subscriptions')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('endpoint', body.endpoint);

  if (error) throw error;
  return respostaOk({ ok: true });
});
