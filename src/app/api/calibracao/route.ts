import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    const { data, error } = await admin
      .from('configuracoes')
      .select('criterios_sucesso, calibracao_inicial_concluida_em')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      criteriosSucesso: (data?.criterios_sucesso as Record<string, unknown>) ?? {},
      concluidaEm:
        (data as Record<string, unknown> | null)?.calibracao_inicial_concluida_em ?? null,
    });
  } catch (err) {
    console.error('/api/calibracao GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar calibração' },
      { status: 500 },
    );
  }
}

interface PostBody {
  criteriosSucesso: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostBody;

    if (!body.criteriosSucesso || typeof body.criteriosSucesso !== 'object') {
      return NextResponse.json(
        { error: 'Campo criteriosSucesso é obrigatório e deve ser um objeto' },
        { status: 400 },
      );
    }

    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    // Verifica se já tem data de conclusão para preservá-la (refazer reseta)
    const { data: atual } = await admin
      .from('configuracoes')
      .select('calibracao_inicial_concluida_em')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    const jaConcluidaEm = (atual as Record<string, unknown> | null)
      ?.calibracao_inicial_concluida_em;

    const patch: Record<string, unknown> = {
      criterios_sucesso: body.criteriosSucesso,
    };

    // Carimba a data apenas se ainda não foi preenchida
    if (!jaConcluidaEm) {
      patch.calibracao_inicial_concluida_em = new Date().toISOString();
    }

    const { error } = await admin.from('configuracoes').update(patch).eq('usuario_id', usuarioId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('/api/calibracao POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao salvar calibração' },
      { status: 500 },
    );
  }
}
