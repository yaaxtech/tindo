/**
 * GET /api/recalibrar/gatilhos
 * Refresha a view materializada de KPIs e retorna diagnóstico de recalibração.
 */

import { getAdminClient } from '@/lib/supabase/admin';
import { verificarGatilhos } from '@/services/calibracao';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = getAdminClient();

    // Refresha view materializada via RPC
    await admin.rpc('refresh_kpis_usuario_diario');

    const resultado = await verificarGatilhos();

    return NextResponse.json(resultado);
  } catch (err) {
    console.error('/api/recalibrar/gatilhos error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao verificar gatilhos' },
      { status: 500 },
    );
  }
}
