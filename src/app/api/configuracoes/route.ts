import { type NextRequest, NextResponse } from 'next/server';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const { data, error } = await admin
      .from('configuracoes')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ configuracoes: data });
  } catch (err) {
    console.error('/api/configuracoes GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}

interface PatchPayload {
  peso_urgencia?: number;
  peso_importancia?: number;
  peso_facilidade?: number;
  audio_habilitado?: boolean;
  animacoes_habilitadas?: boolean;
  todoist_sync_habilitado?: boolean;
  ai_habilitado?: boolean;
  limiar_recalibracao_reavaliacao?: number;
  limiar_recalibracao_descarte?: number;
  limiar_recalibracao_adiamento?: number;
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const body = (await request.json()) as PatchPayload;

    // Valida pesos somam 1 (tolerância 0.01)
    if (
      body.peso_urgencia !== undefined &&
      body.peso_importancia !== undefined &&
      body.peso_facilidade !== undefined
    ) {
      const soma = body.peso_urgencia + body.peso_importancia + body.peso_facilidade;
      if (Math.abs(soma - 1.0) > 0.01) {
        return NextResponse.json(
          { error: `Pesos precisam somar 1.0 (atual: ${soma.toFixed(3)})` },
          { status: 400 },
        );
      }
    }

    const { error } = await admin
      .from('configuracoes')
      .update(body)
      .eq('usuario_id', usuarioId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('/api/configuracoes PATCH error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
