import { createClient } from '@/lib/supabase/client';
import type { Gamificacao, Tarefa } from '@/types/domain';

/** XP de uma conclusão dado a nota. */
export function xpDeConclusao(tarefa: Tarefa): number {
  if (tarefa.tipo === 'lembrete') return 5;
  return 10 + Math.round(tarefa.nota / 10);
}

/** XP para atingir o próximo nível. */
export function xpParaNivel(nivel: number): number {
  return Math.round(50 * nivel ** 1.5);
}

export function calcularNivelAtual(xpTotal: number): number {
  let nivel = 1;
  let acum = 0;
  while (acum + xpParaNivel(nivel) <= xpTotal) {
    acum += xpParaNivel(nivel);
    nivel += 1;
  }
  return nivel;
}

export async function registrarConclusao(tarefa: Tarefa): Promise<Gamificacao | null> {
  const supabase = createClient();
  const ganho = xpDeConclusao(tarefa);
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: atual, error: errSel } = await supabase.from('gamificacao').select('*').single();
  if (errSel) return null;
  const tudo = atual as unknown as Gamificacao | null;
  if (!tudo) return null;

  let novoStreak = tudo.streakAtual;
  if (tudo.ultimoDiaAtivo !== hoje) {
    const onteOk = (() => {
      if (!tudo.ultimoDiaAtivo) return false;
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      return tudo.ultimoDiaAtivo === ontem.toISOString().slice(0, 10);
    })();
    novoStreak = onteOk ? tudo.streakAtual + 1 : 1;
  }

  const xpTotal = tudo.xpTotal + ganho;
  const nivel = calcularNivelAtual(xpTotal);
  const recorde = Math.max(tudo.streakRecorde, novoStreak);

  const { data: atualizado, error: errUpd } = await supabase
    .from('gamificacao')
    .update({
      xp_total: xpTotal,
      nivel,
      streak_atual: novoStreak,
      streak_recorde: recorde,
      ultimo_dia_ativo: hoje,
      tarefas_concluidas_total:
        tarefa.tipo === 'tarefa' ? tudo.tarefasConcluidasTotal + 1 : tudo.tarefasConcluidasTotal,
      lembretes_concluidos_total:
        tarefa.tipo === 'lembrete'
          ? tudo.lembretesConcluidosTotal + 1
          : tudo.lembretesConcluidosTotal,
    })
    .eq('usuario_id', tudo.usuarioId)
    .select()
    .single();

  if (errUpd) return null;
  return atualizado as unknown as Gamificacao;
}
