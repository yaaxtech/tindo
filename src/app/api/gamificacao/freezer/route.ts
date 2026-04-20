export const runtime = 'edge';

import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { comprarFreezerAdmin } from '@/services/gamificacao';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Payload {
  acao: 'comprar';
}

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const body = (await request.json()) as Payload;

    if (body.acao !== 'comprar') {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
    }

    const resultado = await comprarFreezerAdmin(admin, usuarioId);

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.erro }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      freezersDisponiveis: resultado.freezersDisponiveis,
      xpRestante: resultado.xpRestante,
    });
  } catch (err) {
    console.error('/api/gamificacao/freezer POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar freezer.' },
      { status: 500 },
    );
  }
}
