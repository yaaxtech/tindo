/**
 * POST /api/recalibrar/aplicar
 * Body: { amostras: Array<{ tarefaId: string; notaHumana: number }> }
 * Calcula novos pesos, aplica, dispara recálculo batch e registra em calibracoes.
 */

import { calcularNovosPesos } from '@/lib/recalibracao/correlacao';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import {
  aplicarNovosPesos,
  registrarCalibracao,
  verificarGatilhos,
} from '@/services/calibracao';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface AmostraInput {
  tarefaId: string;
  notaHumana: number;
}

interface RequestBody {
  amostras: AmostraInput[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { amostras: amostrasInput } = body;

    if (!Array.isArray(amostrasInput) || amostrasInput.length < 3) {
      return NextResponse.json(
        { error: 'São necessárias pelo menos 3 avaliações para recalibrar.' },
        { status: 400 },
      );
    }

    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    // Busca dados atuais das tarefas
    const tarefaIds = amostrasInput.map((a) => a.tarefaId);
    const { data: tarRows, error: tarErr } = await admin
      .from('tarefas')
      .select('id, importancia, urgencia, facilidade, nota')
      .in('id', tarefaIds)
      .eq('usuario_id', usuarioId)
      .is('deleted_at', null);

    if (tarErr) throw tarErr;

    const tarMap = new Map(
      (tarRows ?? []).map((r) => [
        r.id,
        {
          importancia: Number(r.importancia ?? 50),
          urgencia: Number(r.urgencia ?? 50),
          facilidade: Number(r.facilidade ?? 50),
          notaAtual: Number(r.nota ?? 0),
        },
      ]),
    );

    // Busca pesos atuais para passar como fallback
    const { data: cfgRow } = await admin
      .from('configuracoes')
      .select('peso_urgencia, peso_importancia, peso_facilidade')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    const pesosAtuais = {
      urgencia: Number(cfgRow?.peso_urgencia ?? 0.4),
      importancia: Number(cfgRow?.peso_importancia ?? 0.4),
      facilidade: Number(cfgRow?.peso_facilidade ?? 0.2),
    };

    // Monta amostras completas
    const amostrasCompletas = amostrasInput
      .map((a) => {
        const tar = tarMap.get(a.tarefaId);
        if (!tar) return null;
        return {
          importancia: tar.importancia,
          urgencia: tar.urgencia,
          facilidade: tar.facilidade,
          notaHumana: Math.max(0, Math.min(100, Math.round(a.notaHumana))),
          notaAtual: tar.notaAtual,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (amostrasCompletas.length < 3) {
      return NextResponse.json(
        { error: 'Tarefas não encontradas para calcular novos pesos.' },
        { status: 400 },
      );
    }

    const resultado = calcularNovosPesos(amostrasCompletas, pesosAtuais);

    // Aplica pesos novos
    await aplicarNovosPesos(resultado.pesosNovos);

    // Registra em calibracoes
    await registrarCalibracao(resultado);

    // Dispara recálculo batch das notas
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    // Fire-and-forget inline para não bloquear resposta
    void fetch(`${baseUrl}/api/recalcular-notas`, { method: 'POST' }).catch((e) => {
      console.warn('/api/recalibrar/aplicar: recalcular-notas falhou', e);
    });

    return NextResponse.json({
      pesosNovos: resultado.pesosNovos,
      correlacaoAntes: resultado.correlacaoAntes,
      correlacaoDepois: resultado.correlacaoDepois,
      amostras: resultado.amostras,
    });
  } catch (err) {
    console.error('/api/recalibrar/aplicar error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao aplicar recalibração' },
      { status: 500 },
    );
  }
}
