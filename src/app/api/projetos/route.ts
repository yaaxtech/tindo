import { type NextRequest, NextResponse } from 'next/server';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const { data, error } = await admin
      .from('projetos')
      .select('id, todoist_id, nome, cor, ordem_prioridade, multiplicador, ativo')
      .eq('usuario_id', usuarioId)
      .is('deleted_at', null)
      .order('ordem_prioridade', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ projetos: data ?? [] });
  } catch (err) {
    console.error('/api/projetos GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}

interface UpdatePayload {
  // Array de { id, ordem_prioridade, multiplicador? }
  projetos: Array<{
    id: string;
    ordem_prioridade?: number;
    multiplicador?: number;
  }>;
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const body = (await request.json()) as UpdatePayload;

    for (const p of body.projetos) {
      const patch: Record<string, unknown> = {};
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

    return NextResponse.json({ ok: true, atualizados: body.projetos.length });
  } catch (err) {
    console.error('/api/projetos PATCH error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
