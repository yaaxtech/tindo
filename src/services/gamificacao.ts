import { createClient } from '@/lib/supabase/client';
import type { Gamificacao, Tarefa } from '@/types/domain';

// ---------------------------------------------------------------------------
// Freezer de streak
// ---------------------------------------------------------------------------

export interface FreezerInfo {
  freezersDisponiveis: number;
  totalFreezersGanhos: number;
  freezerUsadoEm: string | null;
}

/**
 * Incrementa freezers_disponiveis e total_freezers_ganhos, com cap de 3.
 * Registra em historico_acoes (fire-and-forget — sem bloquear).
 * Uso server-side: passa o client admin e o usuarioId.
 */
export async function ganharFreezerAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SupabaseClient genérico
  adminClient: any,
  usuarioId: string,
  motivo: string,
): Promise<FreezerInfo | null> {
  const { data: atual } = await adminClient
    .from('gamificacao')
    .select('freezers_disponiveis, total_freezers_ganhos')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (!atual) return null;

  const novoDisponivel = Math.min(3, Number(atual.freezers_disponiveis ?? 0) + 1);
  const novoTotal = Number(atual.total_freezers_ganhos ?? 0) + 1;

  await adminClient
    .from('gamificacao')
    .update({ freezers_disponiveis: novoDisponivel, total_freezers_ganhos: novoTotal })
    .eq('usuario_id', usuarioId);

  // Log no historico_acoes (sem tarefa_id — usa sentinela null-safe via RPC não disponível;
  // dados ficam no log de eventos genérico)
  void adminClient.from('historico_acoes').insert({
    usuario_id: usuarioId,
    tarefa_id: '00000000-0000-0000-0000-000000000000', // sentinela: ação de sistema
    acao: 'concluida', // campo mais próximo; dados distinguem
    dados: { origem: 'ganhou_freezer', motivo },
  });

  return {
    freezersDisponiveis: novoDisponivel,
    totalFreezersGanhos: novoTotal,
    freezerUsadoEm: null,
  };
}

/**
 * Compra 1 freezer por 200 XP. Retorna erro se XP insuficiente.
 */
export async function comprarFreezerAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SupabaseClient genérico
  adminClient: any,
  usuarioId: string,
): Promise<{ ok: boolean; erro?: string; freezersDisponiveis: number; xpRestante: number }> {
  const CUSTO_XP = 200;

  const { data: atual } = await adminClient
    .from('gamificacao')
    .select('xp_total, freezers_disponiveis, total_freezers_ganhos')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (!atual) {
    return { ok: false, erro: 'Registro de gamificação não encontrado.', freezersDisponiveis: 0, xpRestante: 0 };
  }

  const xpAtual = Number(atual.xp_total ?? 0);
  if (xpAtual < CUSTO_XP) {
    return {
      ok: false,
      erro: `XP insuficiente. Você tem ${xpAtual} XP e precisa de ${CUSTO_XP} XP.`,
      freezersDisponiveis: Number(atual.freezers_disponiveis ?? 0),
      xpRestante: xpAtual,
    };
  }

  const novoXp = xpAtual - CUSTO_XP;
  const novoDisponivel = Math.min(3, Number(atual.freezers_disponiveis ?? 0) + 1);
  const novoTotal = Number(atual.total_freezers_ganhos ?? 0) + 1;

  await adminClient
    .from('gamificacao')
    .update({
      xp_total: novoXp,
      freezers_disponiveis: novoDisponivel,
      total_freezers_ganhos: novoTotal,
    })
    .eq('usuario_id', usuarioId);

  return { ok: true, freezersDisponiveis: novoDisponivel, xpRestante: novoXp };
}

/**
 * Verifica se deve consumir um freezer (gap de 1 dia) e, se sim, consome.
 * Chamado pelo endpoint de conclusão ao calcular streak.
 *
 * Retorna: novo valor de streakAtual e se o freezer foi usado.
 */
export async function aplicarFreezerSeNecessario(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SupabaseClient genérico
  adminClient: any,
  usuarioId: string,
  streakAtual: number,
  ultimoDiaAtivo: string | null,
  hojeStr: string,
): Promise<{ streakPreservado: boolean; freezerConsumido: boolean }> {
  if (!ultimoDiaAtivo || ultimoDiaAtivo === hojeStr) {
    return { streakPreservado: false, freezerConsumido: false };
  }

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const ontemStr = ontem.toISOString().slice(0, 10);

  // Só aplica freezer se gap for exatamente 1 dia (ontem foi pulado, hoje retornou)
  const anteontem = new Date();
  anteontem.setDate(anteontem.getDate() - 2);
  const anteontemStr = anteontem.toISOString().slice(0, 10);

  if (ultimoDiaAtivo !== anteontemStr) {
    return { streakPreservado: false, freezerConsumido: false };
  }

  // Gap de exatamente 1 dia: ontem não teve atividade
  const { data: gami } = await adminClient
    .from('gamificacao')
    .select('freezers_disponiveis, freezer_usado_em')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (!gami || Number(gami.freezers_disponiveis ?? 0) <= 0) {
    return { streakPreservado: false, freezerConsumido: false };
  }

  // Não usar se já usou hoje ou ontem (evita duplo uso)
  const freezerUsadoEm = gami.freezer_usado_em as string | null;
  if (freezerUsadoEm === hojeStr || freezerUsadoEm === ontemStr) {
    return { streakPreservado: false, freezerConsumido: false };
  }

  await adminClient
    .from('gamificacao')
    .update({
      freezers_disponiveis: Number(gami.freezers_disponiveis) - 1,
      freezer_usado_em: hojeStr,
    })
    .eq('usuario_id', usuarioId);

  void streakAtual; // usado apenas para documentar a intenção
  return { streakPreservado: true, freezerConsumido: true };
}

/**
 * A cada 7 dias de streak, ganha 1 freezer automaticamente.
 * Chame após atualizar o streak no endpoint de conclusão.
 */
export async function verificarFreezersAutomaticos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SupabaseClient genérico
  adminClient: any,
  usuarioId: string,
  novoStreak: number,
): Promise<void> {
  if (novoStreak > 0 && novoStreak % 7 === 0) {
    await ganharFreezerAdmin(adminClient, usuarioId, `streak_${novoStreak}_dias`);
  }
}

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
