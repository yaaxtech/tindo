import { ErroValidacao } from '@/lib/api/erros';
import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

interface SubscribeBody {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  userAgent?: string;
}

export const POST = rotaApi('POST /api/push/subscribe', async (request: NextRequest) => {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const body = (await request.json()) as SubscribeBody;

  const { subscription, userAgent } = body;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new ErroValidacao('Dados de subscription inválidos.');
  }

  // Upsert pelo endpoint (ON CONFLICT endpoint DO UPDATE)
  const { data, error } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        usuario_id: usuarioId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent ?? null,
        ultima_usada_em: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )
    .select('id')
    .single();

  if (error) throw error;
  return respostaOk({ ok: true, id: data.id });
});
