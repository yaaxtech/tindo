/**
 * Revisão da triagem dentro do TinDo.
 *
 * O vigia deixa a sugestão como comentário no item do Todoist (ver
 * `lib/triagem/comentario.ts`). Aqui o TinDo lê essas sugestões e grava a
 * revisão do dono como outro comentário, que o vigia usa para aprender.
 * Salvar ainda NÃO muda projeto, etiqueta, prioridade nem data no Todoist.
 */
import { ErroNaoEncontrado, ErroServicoExterno, ErroValidacao } from '@/lib/api/erros';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { TodoistClient } from '@/lib/todoist/client';
import {
  type ComentarioBruto,
  type RevisaoTinDo,
  type SugestaoVigia,
  estadoPorTarefa,
  formatarRevisao,
  lerCampos,
} from '@/lib/triagem/comentario';

export interface ItemRevisao {
  tarefaId: string;
  conteudo: string;
  descricao: string;
  vencimento: string | null;
  sugestao: SugestaoVigia;
  revisao: RevisaoTinDo | null;
}

export interface OpcaoProjeto {
  id: string;
  nome: string;
}

export interface PainelRevisao {
  entradaId: string;
  totalNaEntrada: number;
  semSugestao: number;
  itens: ItemRevisao[];
  projetos: OpcaoProjeto[];
  etiquetas: string[];
}

async function clienteTodoist(): Promise<TodoistClient> {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const { data } = await admin
    .from('configuracoes')
    .select('todoist_token')
    .eq('usuario_id', usuarioId)
    .maybeSingle();
  const token = (data as { todoist_token: string | null } | null)?.todoist_token;
  if (!token && !process.env.TODOIST_API_TOKEN) {
    throw new ErroValidacao('Conecte o Todoist em /configuracoes.');
  }
  return new TodoistClient(token ?? undefined);
}

function comentariosBrutos(
  notas: Awaited<ReturnType<TodoistClient['listAllTaskComments']>>,
): ComentarioBruto[] {
  return notas.flatMap((n) => {
    const tarefaId = n.item_id ?? n.task_id;
    return tarefaId ? [{ tarefaId, texto: n.content, em: n.posted_at ?? '' }] : [];
  });
}

export async function listarRevisao(): Promise<PainelRevisao> {
  const td = await clienteTodoist();
  const [projetos, labels, tasks, notas] = await Promise.all([
    td.listProjects(),
    td.listLabels(),
    td.listTasks(),
    td.listAllTaskComments(),
  ]);
  const entrada = projetos.find((p) => p.inbox_project);
  if (!entrada) throw new ErroServicoExterno('Não encontrei a Entrada no seu Todoist.');

  const estado = estadoPorTarefa(comentariosBrutos(notas));
  const naEntrada = tasks.filter(
    (t) => !t.checked && !t.is_deleted && !t.parent_id && t.project_id === entrada.id,
  );
  const itens: ItemRevisao[] = [];
  for (const t of tasks) {
    const e = estado.get(t.id);
    if (!e || t.checked || t.is_deleted) continue;
    itens.push({
      tarefaId: t.id,
      conteudo: t.content,
      descricao: t.description ?? '',
      vencimento: t.due?.datetime ?? t.due?.date ?? null,
      sugestao: e.sugestao,
      revisao: e.revisao,
    });
  }
  // Pendentes primeiro; dentro de cada grupo, menor confiança primeiro.
  itens.sort(
    (a, b) =>
      Number(a.revisao !== null) - Number(b.revisao !== null) ||
      a.sugestao.confianca - b.sugestao.confianca,
  );

  return {
    entradaId: entrada.id,
    totalNaEntrada: naEntrada.length,
    semSugestao: naEntrada.filter((t) => !estado.has(t.id)).length,
    itens,
    projetos: projetos
      .filter((p) => !p.is_archived && !p.is_deleted && !p.inbox_project)
      .map((p) => ({ id: p.id, nome: p.name }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    etiquetas: labels
      .filter((l) => !l.is_deleted)
      .map((l) => l.name)
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}

/** Grava a revisão do dono como comentário no item. Não altera a tarefa. */
export async function registrarRevisao(
  tarefaId: string,
  camposBrutos: unknown,
  nota: string,
): Promise<RevisaoTinDo> {
  if (!tarefaId) throw new ErroValidacao('Tarefa não informada.');
  const campos =
    camposBrutos && typeof camposBrutos === 'object' && !Array.isArray(camposBrutos)
      ? lerCampos(camposBrutos as Record<string, unknown>)
      : null;
  if (!campos) throw new ErroValidacao('Confira tipo e prioridade antes de salvar.');

  const td = await clienteTodoist();
  const [notas, projetos] = await Promise.all([td.listTaskComments(tarefaId), td.listProjects()]);
  const estado = estadoPorTarefa(
    notas.map((n) => ({ tarefaId, texto: n.content, em: n.posted_at ?? '' })),
  ).get(tarefaId);
  if (!estado) throw new ErroNaoEncontrado('Esse item não tem sugestão do vigia.');

  const nomes = new Map(projetos.map((p) => [p.id, p.name]));
  const { texto, revisao } = formatarRevisao(campos, estado.sugestao, nota, (id) =>
    id ? (nomes.get(id) ?? 'projeto') : 'Entrada',
  );
  await td.addTaskComment(tarefaId, texto);
  return revisao;
}
