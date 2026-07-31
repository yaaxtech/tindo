import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const { data, error } = await admin
      .from('espacos_trabalho')
      .select('id, todoist_id, nome, ordem_prioridade, ativo')
      .eq('usuario_id', usuarioId)
      .is('deleted_at', null)
      .order('ordem_prioridade', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ espacos: data ?? [] });
  } catch (err) {
    console.error('/api/espacos-trabalho GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}

interface UpdatePayload {
  espacos: Array<{ id: string; ordem_prioridade?: number; ativo?: boolean }>;
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const body = (await request.json()) as UpdatePayload;

    for (const e of body.espacos) {
      const patch: Record<string, unknown> = {};
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

    return NextResponse.json({ ok: true, atualizados: body.espacos.length });
  } catch (err) {
    console.error('/api/espacos-trabalho PATCH error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
