import { calcularNota } from '@/lib/scoring/engine';
import { createClient } from '@/lib/supabase/client';
import type { Configuracoes, Tarefa } from '@/types/domain';

/**
 * STUB inicial — conecta com Supabase quando credenciais estiverem presentes.
 * Enquanto isso, mock local via `src/lib/mock/tarefas.ts`.
 */

export async function listarFilaCards(_config: Configuracoes): Promise<Tarefa[]> {
  // TODO: buscar da view `fila_cards` e hidratar com tags/projeto
  const supabase = createClient();
  const { data, error } = await supabase.from('tarefas').select('*').limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as Tarefa[];
}

export async function concluirTarefa(tarefaId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('tarefas')
    .update({ status: 'concluida', concluida_em: new Date().toISOString() })
    .eq('id', tarefaId);
  if (error) throw error;
}

export async function adiarTarefa(tarefaId: string, ate: Date, motivoAuto?: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('tarefas')
    .update({
      adiada_ate: ate.toISOString(),
      adiamento_motivo_auto: motivoAuto ?? null,
    })
    .eq('id', tarefaId);
  if (error) throw error;
}

export async function excluirTarefa(tarefaId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('tarefas')
    .update({ deleted_at: new Date().toISOString(), status: 'excluida' })
    .eq('id', tarefaId);
  if (error) throw error;
}

export async function recalcularNota(tarefa: Tarefa, config: Configuracoes): Promise<number> {
  const nota = calcularNota(
    {
      tipo: tarefa.tipo,
      prioridade: tarefa.prioridade,
      dataVencimento: tarefa.dataVencimento,
      prazoConclusao: tarefa.prazoConclusao,
      importancia: tarefa.importancia,
      urgencia: tarefa.urgencia,
      facilidade: tarefa.facilidade,
      projeto: tarefa.projeto,
      tags: tarefa.tags,
    },
    config,
  );
  const supabase = createClient();
  await supabase.from('tarefas').update({ nota }).eq('id', tarefa.id);
  return nota;
}
