// Chamado pelo cron diário após refresh KPIs e sync Todoist.
// Auth: header `Authorization: Bearer <CRON_SECRET>`.

export const runtime = 'edge';

import { getUsuarioIdMVP } from '@/lib/supabase/admin';
import { verificarEDispararGatilhos } from '@/services/push';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Valida CRON_SECRET para uso do cron externo
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = request.headers.get('authorization');
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
      }
    }

    const usuarioId = await getUsuarioIdMVP();
    const resultados = await verificarEDispararGatilhos(usuarioId);
    return NextResponse.json({ ok: true, resultados });
  } catch (err) {
    console.error('[push/disparar-gatilhos] erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao disparar gatilhos push.' },
      { status: 500 },
    );
  }
}
