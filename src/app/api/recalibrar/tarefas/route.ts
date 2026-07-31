/**
 * GET /api/recalibrar/tarefas
 * Retorna 5 tarefas pendentes espalhadas por faixa de nota para o wizard.
 */

import { obterTarefasParaCalibrar } from '@/services/calibracao';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tarefas = await obterTarefasParaCalibrar(5);
    return NextResponse.json({ tarefas });
  } catch (err) {
    console.error('/api/recalibrar/tarefas error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar tarefas' },
      { status: 500 },
    );
  }
}
