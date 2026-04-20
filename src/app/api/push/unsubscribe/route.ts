import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface UnsubscribeBody {
  endpoint: string;
}

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const body = (await request.json()) as UnsubscribeBody;

    if (!body?.endpoint) {
      return NextResponse.json({ error: 'endpoint é obrigatório.' }, { status: 400 });
    }

    const { error } = await admin
      .from('push_subscriptions')
      .delete()
      .eq('usuario_id', usuarioId)
      .eq('endpoint', body.endpoint);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[push/unsubscribe] erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao remover subscription.' },
      { status: 500 },
    );
  }
}
