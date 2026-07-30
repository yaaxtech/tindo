export const runtime = 'edge';

import { getUsuarioIdMVP } from '@/lib/supabase/admin';
import { enviarPush } from '@/services/push';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const usuarioId = await getUsuarioIdMVP();
    const resultado = await enviarPush(usuarioId, 'teste', {
      titulo: 'TinDo — teste',
      corpo: 'Se você viu isso, push esta funcionando.',
      url: '/cards',
      tag: 'teste-push',
    });
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    console.error('[push/testar] erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao testar push.' },
      { status: 500 },
    );
  }
}
