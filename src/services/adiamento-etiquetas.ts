import {
  type DestinoAdiamento,
  type EtiquetaAdiamento,
  calcularDestino,
  lerEtiquetaAdiamento,
} from '@/lib/adiamento/etiquetas';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { TodoistClient } from '@/lib/todoist/client';

export interface ItemAdiamentoPrevia {
  todoistId: string;
  conteudo: string;
  etiqueta: EtiquetaAdiamento;
  recorrente: boolean;
  vencimentoAtual: string | null;
  destino: DestinoAdiamento;
}

/**
 * Só leitura: lista os itens do Todoist marcados com etiqueta de adiamento e
 * mostra para quando o TinDo os mandaria. Não grava nada no Todoist.
 */
export async function previaAdiamentoPorEtiqueta(
  agora = new Date(),
): Promise<ItemAdiamentoPrevia[]> {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const { data: cfgRow } = await admin
    .from('configuracoes')
    .select('todoist_token')
    .eq('usuario_id', usuarioId)
    .maybeSingle();
  const token = (cfgRow as { todoist_token: string | null } | null)?.todoist_token;

  const td = new TodoistClient(token ?? undefined);
  const tasks = await td.listTasks();

  const itens: ItemAdiamentoPrevia[] = [];
  for (const t of tasks) {
    const etiqueta = lerEtiquetaAdiamento(t.labels);
    if (!etiqueta || t.checked || t.is_deleted) continue;
    itens.push({
      todoistId: t.id,
      conteudo: t.content,
      etiqueta,
      recorrente: t.due?.is_recurring ?? false,
      vencimentoAtual: t.due?.datetime ?? t.due?.date ?? null,
      destino: calcularDestino({
        etiqueta,
        agora,
        prioridadeApi: t.priority,
        prazo: t.deadline?.date ?? null,
      }),
    });
  }
  return itens;
}
