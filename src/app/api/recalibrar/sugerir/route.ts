/**
 * POST /api/recalibrar/sugerir
 * Se houver gatilho ativo, marca recalibracao_sugerida_em e retorna motivo.
 */

export const runtime = 'edge';

import { marcarRecalibracaoSugerida, verificarGatilhos } from '@/services/calibracao';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { gatilhos, deveRecalibrar } = await verificarGatilhos();

    if (!deveRecalibrar) {
      return NextResponse.json({ sugerida: false, motivo: null });
    }

    const motivo = gatilhos.map((g) => g.label).join('; ');
    await marcarRecalibracaoSugerida(motivo);

    return NextResponse.json({ sugerida: true, motivo });
  } catch (err) {
    console.error('/api/recalibrar/sugerir error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
