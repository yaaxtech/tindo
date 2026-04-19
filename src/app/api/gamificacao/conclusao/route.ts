import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { calcularNivelAtual } from '@/services/gamificacao';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Payload {
  tarefaId: string;
  tipo: 'tarefa' | 'lembrete';
  nota: number;
}

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const body = (await request.json()) as Payload;

    const xpGanho = body.tipo === 'lembrete' ? 5 : 10 + Math.round(body.nota / 10);

    const hojeStr = new Date().toISOString().slice(0, 10);

    const { data: atual } = await admin
      .from('gamificacao')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    const atualAjustado = atual
      ? {
          xpTotal: Number(atual.xp_total ?? 0),
          nivel: Number(atual.nivel ?? 1),
          streakAtual: Number(atual.streak_atual ?? 0),
          streakRecorde: Number(atual.streak_recorde ?? 0),
          ultimoDiaAtivo: atual.ultimo_dia_ativo as string | null,
          tarefasConcluidasTotal: Number(atual.tarefas_concluidas_total ?? 0),
          lembretesConcluidosTotal: Number(atual.lembretes_concluidos_total ?? 0),
        }
      : {
          xpTotal: 0,
          nivel: 1,
          streakAtual: 0,
          streakRecorde: 0,
          ultimoDiaAtivo: null as string | null,
          tarefasConcluidasTotal: 0,
          lembretesConcluidosTotal: 0,
        };

    let novoStreak = atualAjustado.streakAtual;
    let xpBonus = 0;
    if (atualAjustado.ultimoDiaAtivo !== hojeStr) {
      // Primeiro do dia
      xpBonus += 10;
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      const ontemStr = ontem.toISOString().slice(0, 10);
      novoStreak = atualAjustado.ultimoDiaAtivo === ontemStr ? atualAjustado.streakAtual + 1 : 1;
    } else if (atualAjustado.streakAtual > 0) {
      xpBonus += 5; // streak ativo
    }

    const xpTotal = atualAjustado.xpTotal + xpGanho + xpBonus;
    const nivel = calcularNivelAtual(xpTotal);
    const recorde = Math.max(atualAjustado.streakRecorde, novoStreak);
    const subiuNivel = nivel > atualAjustado.nivel;
    const quebrouRecorde = novoStreak > atualAjustado.streakRecorde;

    const patch = {
      xp_total: xpTotal,
      nivel,
      streak_atual: novoStreak,
      streak_recorde: recorde,
      ultimo_dia_ativo: hojeStr,
      tarefas_concluidas_total:
        body.tipo === 'tarefa'
          ? atualAjustado.tarefasConcluidasTotal + 1
          : atualAjustado.tarefasConcluidasTotal,
      lembretes_concluidos_total:
        body.tipo === 'lembrete'
          ? atualAjustado.lembretesConcluidosTotal + 1
          : atualAjustado.lembretesConcluidosTotal,
    };

    if (atual) {
      await admin.from('gamificacao').update(patch).eq('usuario_id', usuarioId);
    } else {
      await admin.from('gamificacao').insert({ usuario_id: usuarioId, ...patch });
    }

    return NextResponse.json({
      xpGanho: xpGanho + xpBonus,
      xpBase: xpGanho,
      xpBonus,
      nivel,
      subiuNivel,
      streakAtual: novoStreak,
      quebrouRecorde,
    });
  } catch (err) {
    console.error('/api/gamificacao/conclusao error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
