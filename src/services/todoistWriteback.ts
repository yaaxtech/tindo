/**
 * Helper de propagação para o Todoist (write-back opt-in).
 *
 * Só propaga quando `todoist_writeback_habilitado = true` em configuracoes.
 * Nunca lança exceção para cima — erros são logados e retornam { pulada: false }.
 * MVP single-user: token fixo via TODOIST_API_TOKEN.
 */

import { getAdminClient } from '@/lib/supabase/admin';
import {
  atualizarTodoistTask,
  concluirTodoistTask,
  excluirTodoistTask,
  reabrirTodoistTask,
} from '@/lib/todoist/client';

export interface PropagacaoResult {
  pulada: boolean;
  motivo?: string;
}

export interface PropagacaoParams {
  usuarioId: string;
  tarefaId: string;
  acao: 'concluir' | 'reabrir' | 'atualizar' | 'excluir';
  patch?: {
    titulo?: string;
    descricao?: string;
    dataVencimento?: string | null; // YYYY-MM-DD ou null
    prioridade?: 1 | 2 | 3 | 4; // prioridade TinDo (1=urgente, 4=normal)
  };
}

/**
 * Propaga uma ação do TinDo para o Todoist, se o write-back estiver habilitado.
 * Fire-and-forget seguro: nunca joga exceção para cima.
 */
export async function propagarParaTodoist(params: PropagacaoParams): Promise<PropagacaoResult> {
  const { usuarioId, tarefaId, acao, patch } = params;

  try {
    const admin = getAdminClient();

    // 1. Verificar flag todoist_writeback_habilitado
    const { data: config } = await admin
      .from('configuracoes')
      .select('todoist_writeback_habilitado')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (!config?.todoist_writeback_habilitado) {
      return { pulada: true, motivo: 'flag off' };
    }

    // 2. Buscar tarefa e verificar todoist_id
    const { data: tarefa } = await admin
      .from('tarefas')
      .select('todoist_id')
      .eq('id', tarefaId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (!tarefa?.todoist_id) {
      return { pulada: true, motivo: 'sem todoist_id' };
    }

    const todoistId = tarefa.todoist_id as string;

    // 3. Token MVP single-user
    const token = process.env.TODOIST_API_TOKEN;
    if (!token) {
      return { pulada: true, motivo: 'TODOIST_API_TOKEN ausente' };
    }

    // 4. Executar ação correspondente
    switch (acao) {
      case 'concluir':
        await concluirTodoistTask(token, todoistId);
        break;

      case 'reabrir':
        await reabrirTodoistTask(token, todoistId);
        break;

      case 'atualizar': {
        if (!patch || Object.keys(patch).length === 0) break;
        // Mapeia prioridade TinDo (1=urgente→4 Todoist) para Todoist (1=normal, 4=urgent)
        const prioridadeTodoist =
          patch.prioridade !== undefined ? ((5 - patch.prioridade) as 1 | 2 | 3 | 4) : undefined;
        await atualizarTodoistTask(token, todoistId, {
          content: patch.titulo,
          description: patch.descricao,
          due_date: patch.dataVencimento,
          priority: prioridadeTodoist,
        });
        break;
      }

      case 'excluir':
        await excluirTodoistTask(token, todoistId);
        break;
    }

    // 5. Registrar em historico_acoes
    await admin.from('historico_acoes').insert({
      usuario_id: usuarioId,
      tarefa_id: tarefaId,
      acao: 'editada',
      dados: { origem: 'todoist_writeback', acao },
    });

    return { pulada: false };
  } catch (err) {
    console.error('[todoist-writeback] erro ao propagar:', err);
    // Nunca propaga exceção — o write-back é best-effort
    return { pulada: false };
  }
}
