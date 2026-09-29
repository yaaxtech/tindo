/**
 * Triagem da Entrada do Todoist (fatia 2a: só prévia, nada é gravado).
 *
 * Lê a Entrada, pede à IA a classificação de cada item novo e devolve o plano
 * do que seria mudado. A aplicação no Todoist (com etiqueta IA, log e desfazer)
 * entra numa fatia seguinte, depois do OK do dono.
 */
import { ErroServicoExterno, ErroValidacao } from '@/lib/api/erros';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { TodoistClient, type TodoistTask } from '@/lib/todoist/client';
import { descreverFalhaIA } from '@/lib/triagem/falha-ia';
import {
  type ItemEntrada,
  type PlanoTriagem,
  type PrioridadeApi,
  montarPlano,
  precisaTriagem,
} from '@/lib/triagem/plano';
import {
  type ContextoTriagem,
  TOOL_TRIAR_ENTRADA,
  lerRespostaTriagem,
  montarMensagemTriagem,
  montarSystemTriagem,
} from '@/lib/triagem/prompt';
import Anthropic from '@anthropic-ai/sdk';

const MODELO_DEFAULT = 'claude-sonnet-4-6';
const MAX_EXEMPLOS = 60;
const MAX_FRENTES = 40;

export interface PreviaTriagem {
  totalNaEntrada: number;
  pendentesDeTriagem: number;
  planos: PlanoTriagem[];
  erros: Array<{ tarefaId: string; conteudo: string; erro: string }>;
  nomesProjetos: Record<string, string>;
}

function paraItem(t: TodoistTask): ItemEntrada {
  return {
    id: t.id,
    conteudo: t.content,
    projetoId: t.project_id,
    etiquetas: t.labels,
    prioridadeApi: t.priority as PrioridadeApi,
    vencimento: t.due?.datetime ?? t.due?.date ?? null,
  };
}

export async function gerarPreviaTriagem(limite = 10): Promise<PreviaTriagem> {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const { data: cfgRow } = await admin
    .from('configuracoes')
    .select('todoist_token, ai_api_key_criptografada, ai_modelo')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  const cfg = cfgRow as {
    todoist_token: string | null;
    ai_api_key_criptografada: string | null;
    ai_modelo: string | null;
  } | null;
  const apiKey = cfg?.ai_api_key_criptografada ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ErroValidacao('Configure sua chave Claude em /configuracoes.');

  const td = new TodoistClient(cfg?.todoist_token ?? undefined);
  const [projetos, labels, tasks] = await Promise.all([
    td.listProjects(),
    td.listLabels(),
    td.listTasks(),
  ]);

  const inbox = projetos.find((p) => p.inbox_project);
  if (!inbox) throw new ErroServicoExterno('Não encontrei a Entrada no seu Todoist.');

  const abertas = tasks.filter((t) => !t.checked && !t.is_deleted);
  const naEntrada = abertas.filter((t) => t.project_id === inbox.id && !t.parent_id);
  const pendentes = naEntrada.filter((t) => precisaTriagem(t.labels));
  const nomeProjeto = new Map(projetos.map((p) => [p.id, p.name]));

  const ativos = projetos.filter((p) => !p.is_archived && !p.is_deleted);
  const ctx: ContextoTriagem = {
    projetos: ativos.map((p) => ({ id: p.id, nome: p.name })),
    etiquetas: labels.map((l) => l.name),
    exemplos: abertas
      .filter((t) => t.project_id !== inbox.id && t.labels.length > 0 && precisaTriagem(t.labels))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, MAX_EXEMPLOS)
      .map((t) => ({
        conteudo: t.content,
        projeto: nomeProjeto.get(t.project_id) ?? '?',
        etiquetas: t.labels,
        prioridade: (5 - t.priority) as 1 | 2 | 3 | 4,
      })),
    frentes: abertas
      .filter((t) => t.content.includes(' ! '))
      .slice(0, MAX_FRENTES)
      .map((t) => ({ id: t.id, conteudo: t.content })),
  };

  const contextoPlano = {
    projetosValidos: new Set(ativos.map((p) => p.id)),
    etiquetasExistentes: new Map(labels.map((l) => [l.name.toLowerCase(), l.name])),
    frentesValidas: new Set(ctx.frentes.map((f) => f.id)),
  };

  const anthropic = new Anthropic({ apiKey });
  const system = montarSystemTriagem(ctx);
  const planos: PlanoTriagem[] = [];
  const erros: PreviaTriagem['erros'] = [];

  // Em série: poucas chamadas, e o bloco de contexto fica em cache entre elas.
  for (const t of pendentes.slice(0, limite)) {
    try {
      const resposta = await anthropic.messages.create({
        model: cfg?.ai_modelo ?? MODELO_DEFAULT,
        max_tokens: 1024,
        // biome-ignore lint/suspicious/noExplicitAny: SDK types for system array with cache_control
        system: system as any,
        // biome-ignore lint/suspicious/noExplicitAny: SDK 0.30 não tipa type: ['string','null']
        tools: [TOOL_TRIAR_ENTRADA as any],
        tool_choice: { type: 'tool', name: TOOL_TRIAR_ENTRADA.name },
        messages: [
          {
            role: 'user',
            content: montarMensagemTriagem({
              conteudo: t.content,
              descricao: t.description,
              data: t.due?.datetime ?? t.due?.date ?? null,
            }),
          },
        ],
      });
      const bloco = resposta.content.find((b) => b.type === 'tool_use');
      if (!bloco || bloco.type !== 'tool_use') throw new Error('IA não respondeu a triagem.');
      planos.push(
        montarPlano(
          paraItem(t),
          lerRespostaTriagem(bloco.input as Record<string, unknown>),
          contextoPlano,
        ),
      );
    } catch (err) {
      console.error('[triagem] falha no item', t.id, err);
      const falha = descreverFalhaIA(err);
      // Chave, crédito ou modelo: vai falhar igual em todos, então avisa uma vez só.
      if (falha.geral) throw new ErroServicoExterno(falha.mensagem, { cause: err });
      erros.push({ tarefaId: t.id, conteudo: t.content, erro: falha.mensagem });
    }
  }

  return {
    totalNaEntrada: naEntrada.length,
    pendentesDeTriagem: pendentes.length,
    planos,
    erros,
    nomesProjetos: Object.fromEntries(nomeProjeto),
  };
}
