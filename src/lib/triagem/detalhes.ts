/**
 * Detalhes de um item para a /triagem: quem criou e o texto da mescla.
 * Funções puras.
 */
import type { TodoistPessoa } from '@/lib/todoist/client';

/** Nome de quem criou; "você" quando foi o próprio dono. */
export function nomeDaPessoa(
  uid: string | null | undefined,
  eu: TodoistPessoa | null,
  colaboradores: TodoistPessoa[],
): string | null {
  if (!uid) return null;
  if (eu && eu.id === uid) return 'você';
  const p = colaboradores.find((c) => c.id === uid);
  return p?.full_name || p?.email || null;
}

export interface TarefaMescla {
  conteudo: string;
  descricao: string;
}

/**
 * Descrição da tarefa que fica depois de mesclar: a dela, seguida do título
 * e da descrição da que vai ser apagada, para nada se perder.
 */
export function descricaoMesclada(fica: TarefaMescla, sai: TarefaMescla): string {
  const trecho = [`Mesclado de: ${sai.conteudo.trim()}`];
  if (sai.descricao.trim()) trecho.push(sai.descricao.trim());
  const atual = fica.descricao.trim();
  return atual ? `${atual}\n\n---\n${trecho.join('\n')}` : trecho.join('\n');
}
