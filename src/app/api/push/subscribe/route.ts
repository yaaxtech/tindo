import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface SubscribeBody {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  userAgent?: string;
}

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const body = (await request.json()) as SubscribeBody;

    const { subscription, userAgent } = body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Dados de subscription inválidos.' }, { status: 400 });
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
    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error('[push/subscribe] erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao salvar subscription.' },
      { status: 500 },
    );
  }
}
