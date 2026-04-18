import { NextResponse } from 'next/server';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { sincronizarTodoist } from '@/lib/todoist/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const resultado = await sincronizarTodoist(admin, usuarioId);
    return NextResponse.json({ ok: true, resultado });
  } catch (err) {
    console.error('/api/todoist/sync error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
