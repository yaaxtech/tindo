export const runtime = 'edge';

import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { calcularNivelAtual, xpParaNivel } from '@/services/gamificacao';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const { data, error } = await admin
      .from('gamificacao')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      // Cria default
      const { data: criada, error: errIns } = await admin
        .from('gamificacao')
        .insert({ usuario_id: usuarioId })
        .select()
        .single();
      if (errIns) throw errIns;
      return NextResponse.json({
        gamificacao: adaptar(criada),
        progresso: calcularProgresso(0, 1),
      });
    }

    const xp = Number(data.xp_total ?? 0);
    const nivel = Number(data.nivel ?? 1);
    return NextResponse.json({
      gamificacao: adaptar(data),
      progresso: calcularProgresso(xp, nivel),
    });
  } catch (err) {
    console.error('/api/gamificacao GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}

function adaptar(r: Record<string, unknown>) {
  return {
    xpTotal: Number(r.xp_total ?? 0),
    nivel: Number(r.nivel ?? 1),
    streakAtual: Number(r.streak_atual ?? 0),
    streakRecorde: Number(r.streak_recorde ?? 0),
    ultimoDiaAtivo: r.ultimo_dia_ativo as string | null,
    tarefasConcluidasTotal: Number(r.tarefas_concluidas_total ?? 0),
    lembretesConcluidosTotal: Number(r.lembretes_concluidos_total ?? 0),
    freezersDisponiveis: Number(r.freezers_disponiveis ?? 0),
    totalFreezersGanhos: Number(r.total_freezers_ganhos ?? 0),
  };
}

function calcularProgresso(xpTotal: number, nivelAtual: number) {
  // XP acumulado até o início do nível atual
  let acumulado = 0;
  for (let n = 1; n < nivelAtual; n++) acumulado += xpParaNivel(n);
  const xpNoNivel = xpTotal - acumulado;
  const xpParaProximo = xpParaNivel(nivelAtual);
  return {
    xpNoNivelAtual: xpNoNivel,
    xpParaProximoNivel: xpParaProximo,
    progressoPercentual: Math.round((xpNoNivel / xpParaProximo) * 100),
    nivelSugeridoDoXp: calcularNivelAtual(xpTotal),
  };
}
