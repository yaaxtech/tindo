export const runtime = 'edge';

import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = Number(searchParams.get('offset') ?? '0');
    const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100);

    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    const { data, error } = await admin
      .from('sugestoes_ai')
      .select('id, tipo, tarefa_id, payload, created_at, tarefas(titulo)')
      .eq('usuario_id', usuarioId)
      .eq('status', 'pendente')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: 'Erro ao buscar sugestões.' }, { status: 500 });
    }

    const sugestoes = (data ?? []).map((row) => ({
      id: row.id,
      tipo: row.tipo,
      tarefaId: row.tarefa_id,
      // biome-ignore lint/suspicious/noExplicitAny: dynamic join result
      tarefaTitulo: (row.tarefas as any)?.titulo ?? null,
      payload: row.payload,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ sugestoes });
  } catch (err) {
    console.error('/api/sugestoes-ai GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
