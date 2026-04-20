export const dynamic = 'force-dynamic';

import { marcarRecalibracaoSugerida, verificarGatilhos } from '@/services/calibracao';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { type NextRequest, NextResponse } from 'next/server';

async function handler(request: NextRequest) {
  // Auth via header
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const resultados: Record<string, unknown> = {};

  // 1. Refresh KPIs
  try {
    const { error } = await admin.rpc('refresh_kpis_usuario_diario');
    resultados.kpis_refresh = error ? `erro: ${error.message}` : 'ok';
  } catch (e) {
    resultados.kpis_refresh = `erro: ${(e as Error).message}`;
  }

  // 2. Sync Todoist (se habilitado) — chama endpoint interno
  try {
    const { data: cfg } = await admin
      .from('configuracoes')
      .select('todoist_sync_habilitado')
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    // biome-ignore lint/suspicious/noExplicitAny: config é jsonb
    if ((cfg as any)?.todoist_sync_habilitado) {
      const origin = request.nextUrl.origin;
      const res = await fetch(`${origin}/api/todoist/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      resultados.todoist_sync = res.ok ? 'ok' : `http_${res.status}`;
    } else {
      resultados.todoist_sync = 'flag off';
    }
  } catch (e) {
    resultados.todoist_sync = `erro: ${(e as Error).message}`;
  }

  // 3. Marca recalibração sugerida se gatilhos ativos
  // verificarGatilhos() e marcarRecalibracaoSugerida(motivo) resolvem usuarioId internamente
  try {
    const gat = await verificarGatilhos();
    if (gat.deveRecalibrar) {
      const motivo = gat.gatilhos.map((g) => g.codigo).join(', ');
      await marcarRecalibracaoSugerida(motivo);
      resultados.recalibracao = 'sugerida';
    } else {
      resultados.recalibracao = 'não necessária';
    }
  } catch (e) {
    resultados.recalibracao = `erro: ${(e as Error).message}`;
  }

  // 4. Disparar push notifications (placeholder — outro agente implementa)
  resultados.push = 'pendente (agente push notifications)';

  return NextResponse.json({
    ok: true,
    usuarioId,
    executadoEm: new Date().toISOString(),
    resultados,
  });
}

export const POST = handler;

// Permite GET pra teste (com mesmo auth)
export const GET = handler;
