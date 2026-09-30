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
import {
  TodoistClient,
  atualizarTodoistTask,
  concluirTodoistTask,
  excluirTodoistTask,
  reabrirTodoistTask,
} from '@/lib/todoist/client';
import type { TodoistTask } from '@/lib/todoist/client';
import {
  type ComentarioBruto,
  type RevisaoTinDo,
  type SugestaoVigia,
  estadoPorTarefa,
  formatarRevisao,
  lerCampos,
} from '@/lib/triagem/comentario';
import { descricaoMesclada, nomeDaPessoa } from '@/lib/triagem/detalhes';
import {
  type AvaliacaoTipo,
  type OpcaoAdiar,
  type SugestaoLembrete,
  avaliarTipo,
  destinoDoBotao,
  ehLembrete,
  sugerirParaLembrete,
} from '@/lib/triagem/lembretes';

export interface ItemRevisao {
  tarefaId: string;
  conteudo: string;
  descricao: string;
  vencimento: string | null;
  /** Texto da data como está no Todoist ("toda seg às 18:00"). */
  vencimentoTexto: string | null;
  recorrente: boolean;
  projetoAtual: string;
  criadaEm: string;
  criadaPor: string | null;
  sugestao: SugestaoVigia;
  revisao: RevisaoTinDo | null;
}

/** Dados comuns de qualquer tarefa mostrada na /triagem. */
export interface TarefaResumo {
  tarefaId: string;
  conteudo: string;
  descricao: string;
  vencimento: string | null;
  vencimentoTexto: string | null;
  recorrente: boolean;
  projetoAtual: string;
  criadaEm: string;
  criadaPor: string | null;
}

export interface ItemLembrete extends TarefaResumo {
  prioridade: 'P1' | 'P2' | 'P3' | 'P4';
  tipo: AvaliacaoTipo;
  sugestao: SugestaoLembrete;
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
  /** Itens da Entrada sem classificação e ainda sem sugestão do vigia. */
  semClassificacao: TarefaResumo[];
  /** Todos os lembretes abertos (projetos de lembrete e os da Entrada com etiqueta). */
  lembretes: ItemLembrete[];
  projetos: OpcaoProjeto[];
  etiquetas: string[];
  /** Tarefas abertas com que dá para mesclar (as da Entrada e as do painel). */
  tarefas: Array<{ id: string; conteudo: string }>;
}

async function tokenTodoist(): Promise<string> {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const { data } = await admin
    .from('configuracoes')
    .select('todoist_token')
    .eq('usuario_id', usuarioId)
    .maybeSingle();
  const token = (data as { todoist_token: string | null } | null)?.todoist_token;
  const final = token || process.env.TODOIST_API_TOKEN;
  if (!final) throw new ErroValidacao('Conecte o Todoist em /configuracoes.');
  return final;
}

async function clienteTodoist(): Promise<TodoistClient> {
  return new TodoistClient(await tokenTodoist());
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
  const [projetos, labels, tasks, sync] = await Promise.all([
    td.listProjects(),
    td.listLabels(),
    td.listTasks(),
    td.syncTriagem(),
  ]);
  const notas = sync.notes;
  const nomeProjeto = new Map(projetos.map((p) => [p.id, p.inbox_project ? 'Entrada' : p.name]));
  const entrada = projetos.find((p) => p.inbox_project);
  if (!entrada) throw new ErroServicoExterno('Não encontrei a Entrada no seu Todoist.');

  const estado = estadoPorTarefa(comentariosBrutos(notas));
  const resumo = (t: TodoistTask): TarefaResumo => ({
    tarefaId: t.id,
    conteudo: t.content,
    descricao: t.description ?? '',
    vencimento: t.due?.datetime ?? t.due?.date ?? null,
    vencimentoTexto: t.due?.string ?? null,
    recorrente: t.due?.is_recurring ?? false,
    projetoAtual: nomeProjeto.get(t.project_id) ?? 'projeto',
    criadaEm: t.added_at,
    criadaPor: nomeDaPessoa(t.added_by_uid, sync.user, sync.collaborators),
  });
  const agora = new Date();
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
      vencimentoTexto: t.due?.string ?? null,
      recorrente: t.due?.is_recurring ?? false,
      projetoAtual: nomeProjeto.get(t.project_id) ?? 'projeto',
      criadaEm: t.added_at,
      criadaPor: nomeDaPessoa(t.added_by_uid, sync.user, sync.collaborators),
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

  const abertas = tasks.filter((t) => !t.checked && !t.is_deleted);
  const lembretes: ItemLembrete[] = abertas
    .filter(
      (t) =>
        !estado.has(t.id) &&
        ehLembrete(nomeProjeto.get(t.project_id) ?? '', t.project_id === entrada.id, t.labels),
    )
    .map((t) => ({
      ...resumo(t),
      prioridade: `P${5 - t.priority}` as ItemLembrete['prioridade'],
      tipo: avaliarTipo(t.content, t.description ?? ''),
      sugestao: sugerirParaLembrete({
        agora,
        vencimento: t.due?.date ?? null,
        recorrente: t.due?.is_recurring ?? false,
        prioridadeApi: t.priority,
        prazo: t.deadline?.date ?? null,
      }),
    }))
    // Mais atrasados primeiro; "parece tarefa" sobe dentro do empate.
    .sort(
      (a, b) =>
        b.sugestao.atraso - a.sugestao.atraso ||
        Number(b.tipo.pareceTarefa) - Number(a.tipo.pareceTarefa),
    );

  return {
    entradaId: entrada.id,
    semClassificacao: naEntrada
      .filter((t) => !estado.has(t.id) && t.labels.length === 0)
      .map(resumo),
    lembretes,
    totalNaEntrada: naEntrada.length,
    semSugestao: naEntrada.filter((t) => !estado.has(t.id)).length,
    itens,
    projetos: projetos
      .filter((p) => !p.is_archived && !p.is_deleted && !p.inbox_project)
      .map((p) => ({ id: p.id, nome: p.name }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    tarefas: tasks
      .filter(
        (t) =>
          !t.checked &&
          !t.is_deleted &&
          (estado.has(t.id) || (t.project_id === entrada.id && !t.parent_id)),
      )
      .map((t) => ({ id: t.id, conteudo: t.content })),
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

export type AcaoTarefa = 'concluir' | 'reabrir' | 'excluir';

/**
 * Concluir, reabrir ou excluir a tarefa no Todoist — sempre por clique do dono
 * na /triagem. Excluir no Todoist não tem volta.
 */
export async function executarAcao(acao: AcaoTarefa, tarefaId: string): Promise<void> {
  if (!tarefaId) throw new ErroValidacao('Tarefa não informada.');
  const token = await tokenTodoist();
  try {
    if (acao === 'concluir') await concluirTodoistTask(token, tarefaId);
    else if (acao === 'reabrir') await reabrirTodoistTask(token, tarefaId);
    else await excluirTodoistTask(token, tarefaId);
  } catch (cause) {
    throw new ErroServicoExterno('O Todoist não aceitou agora. Tente de novo.', { cause });
  }
}

/**
 * Mescla duas tarefas: a que fica recebe na descrição o texto da outra, e a
 * outra é excluída do Todoist.
 */
export async function mesclarTarefas(ficaId: string, saiId: string): Promise<void> {
  if (!ficaId || !saiId || ficaId === saiId) {
    throw new ErroValidacao('Escolha duas tarefas diferentes para mesclar.');
  }
  const token = await tokenTodoist();
  const td = new TodoistClient(token);
  const [fica, sai] = await Promise.all([td.getTask(ficaId), td.getTask(saiId)]).catch((cause) => {
    throw new ErroNaoEncontrado('Não encontrei uma das tarefas no Todoist.', { cause });
  });
  try {
    await atualizarTodoistTask(token, fica.id, {
      description: descricaoMesclada(
        { conteudo: fica.content, descricao: fica.description ?? '' },
        { conteudo: sai.content, descricao: sai.description ?? '' },
      ),
    });
    await excluirTodoistTask(token, sai.id);
  } catch (cause) {
    throw new ErroServicoExterno('O Todoist não aceitou a mescla agora. Tente de novo.', {
      cause,
    });
  }
}

export type OpcaoAdiarAcao = OpcaoAdiar | 'sugestao';

/**
 * Adia a tarefa no Todoist por clique do dono na /triagem. Mantém a
 * recorrência: manda a nova data junto com o texto de recorrência atual.
 */
export async function adiarTarefa(
  tarefaId: string,
  opcao: OpcaoAdiarAcao,
  data?: string,
): Promise<{ para: string; motivo: string }> {
  if (!tarefaId) throw new ErroValidacao('Tarefa não informada.');
  const td = await clienteTodoist();
  const t = await td.getTask(tarefaId).catch((cause) => {
    throw new ErroNaoEncontrado('Não encontrei essa tarefa no Todoist.', { cause });
  });
  const agora = new Date();
  const destino =
    opcao === 'sugestao'
      ? sugerirParaLembrete({
          agora,
          vencimento: t.due?.date ?? null,
          recorrente: t.due?.is_recurring ?? false,
          prioridadeApi: t.priority,
          prazo: t.deadline?.date ?? null,
        }).destino
      : destinoDoBotao(opcao, agora, data);
  if (!destino) throw new ErroValidacao('Escolha uma data a partir de amanhã (ex.: 05/10).');

  const due: Record<string, unknown> = { date: destino.dataHoraLocal };
  if (t.due?.is_recurring && t.due.string) {
    due.string = t.due.string;
    due.lang = t.due.lang ?? 'pt';
    due.is_recurring = true;
  }
  try {
    await td.syncComando('item_update', { id: t.id, due });
  } catch (cause) {
    throw new ErroServicoExterno('O Todoist não aceitou o adiamento agora. Tente de novo.', {
      cause,
    });
  }
  return { para: destino.dataHoraLocal, motivo: destino.motivo };
}
