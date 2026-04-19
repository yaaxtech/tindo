import Anthropic from '@anthropic-ai/sdk';
import {
  type ClassificacaoMeta,
  type ContextoClassificacao,
  type ContextoQuebra,
  type ContextoSugestoes,
  type Sugestao,
  montarPromptClassificacao,
  montarPromptQuebra,
  montarPromptSugestoes,
} from '@/lib/ai/prompts';
import type { Projeto, Tag } from '@/types/domain';

export type { Classificacao, ClassificacaoMeta, Sugestao } from '@/lib/ai/prompts';

// ---------------------------------------------------------------------------
// Types — Quebra
// ---------------------------------------------------------------------------

export interface SubTarefa {
  titulo: string;
  descricao: string;
  facilidadeEstimada: number;
}

export interface QuebraTarefaResult {
  deveQuebrar: boolean;
  subTarefas: SubTarefa[];
  explicacao: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// Types — Batch
// ---------------------------------------------------------------------------

export interface BatchItemInput {
  id: string;
  titulo: string;
  descricao?: string | null;
}

export interface BatchItemResultado {
  id: string;
  classificacao?: ClassificacaoMeta;
  erro?: string;
}

export interface ClassificarBatchResult {
  resultados: BatchItemResultado[];
}

const MODELO_DEFAULT = 'claude-sonnet-4-6';
const MAX_TOKENS = 256;

// ---------------------------------------------------------------------------
// quebrarTarefa
// ---------------------------------------------------------------------------

export interface QuebrarTarefaInput {
  titulo: string;
  descricao?: string | null;
  projeto?: string | null;
  apiKey?: string;
  modelo?: string;
}

export async function quebrarTarefa(input: QuebrarTarefaInput): Promise<QuebraTarefaResult> {
  const resolvedKey = input.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!resolvedKey) {
    throw new Error(
      'Configure sua chave Claude em /configuracoes para usar a quebra por IA.',
    );
  }

  const anthropic = new Anthropic({ apiKey: resolvedKey });
  const modelo = input.modelo ?? MODELO_DEFAULT;

  const ctx: ContextoQuebra = {
    titulo: input.titulo,
    descricao: input.descricao,
    projeto: input.projeto,
  };

  const { system, userMessage, tool } = montarPromptQuebra(ctx);

  const response = await anthropic.messages.create({
    model: modelo,
    max_tokens: 512,
    // biome-ignore lint/suspicious/noExplicitAny: SDK types for system array with cache_control
    system: system as any,
    tools: [tool],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('IA não retornou resposta de quebra. Tente novamente.');
  }

  // biome-ignore lint/suspicious/noExplicitAny: tool input is dynamic JSON
  const raw = toolBlock.input as any;

  const subTarefas: SubTarefa[] = Array.isArray(raw.sub_tarefas)
    ? // biome-ignore lint/suspicious/noExplicitAny: iterating dynamic JSON array
      raw.sub_tarefas.map((s: any) => ({
        titulo: String(s.titulo ?? '').slice(0, 80),
        descricao: String(s.descricao ?? '').slice(0, 200),
        facilidadeEstimada: Math.round(
          Math.min(100, Math.max(0, Number(s.facilidade_estimada ?? 50))),
        ),
      }))
    : [];

  return {
    deveQuebrar: Boolean(raw.deve_quebrar),
    subTarefas,
    explicacao: String(raw.explicacao ?? '').slice(0, 140),
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      // biome-ignore lint/suspicious/noExplicitAny: extended usage fields from caching
      cache_creation_input_tokens: (response.usage as any).cache_creation_input_tokens ?? 0,
      // biome-ignore lint/suspicious/noExplicitAny: extended usage fields from caching
      cache_read_input_tokens: (response.usage as any).cache_read_input_tokens ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// classificarBatch — processa até 20 tarefas em série (rate-limit safe)
// ---------------------------------------------------------------------------

export async function classificarBatch(
  tarefas: BatchItemInput[],
  opts?: { apiKey?: string; modelo?: string; projetos?: Projeto[]; tags?: Tag[] },
): Promise<ClassificarBatchResult> {
  const limite = Math.min(tarefas.length, 20);
  const fatia = tarefas.slice(0, limite);
  const resultados: BatchItemResultado[] = [];

  for (const t of fatia) {
    try {
      const classificacao = await classificarTarefa({
        titulo: t.titulo,
        descricao: t.descricao,
        apiKey: opts?.apiKey,
        modelo: opts?.modelo,
        projetos: opts?.projetos ?? [],
        tags: opts?.tags ?? [],
      });
      resultados.push({ id: t.id, classificacao });
    } catch (err) {
      resultados.push({
        id: t.id,
        erro: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  }

  return { resultados };
}

// ---------------------------------------------------------------------------
// sugerirTarefas — Fase E (Caminho Crítico)
// ---------------------------------------------------------------------------

export interface SugerirTarefasInput extends ContextoSugestoes {
  apiKey?: string;
  modelo?: string;
}

export interface SugerirTarefasResult {
  sugestoes: Sugestao[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
}

export async function sugerirTarefas(input: SugerirTarefasInput): Promise<SugerirTarefasResult> {
  const resolvedKey = input.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!resolvedKey) {
    throw new Error(
      'Configure sua chave Claude em /configuracoes para usar sugestões por IA.',
    );
  }

  const anthropic = new Anthropic({ apiKey: resolvedKey });
  const modelo = input.modelo ?? MODELO_DEFAULT;

  const { system, userMessage, tool } = montarPromptSugestoes({
    criteriosSucesso: input.criteriosSucesso,
    projetos: input.projetos,
    tags: input.tags,
    ultimasConcluidas: input.ultimasConcluidas,
    tarefasPendentesResumo: input.tarefasPendentesResumo,
  });

  const response = await anthropic.messages.create({
    model: modelo,
    max_tokens: 1024,
    // biome-ignore lint/suspicious/noExplicitAny: SDK types for system array with cache_control
    system: system as any,
    tools: [tool],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('IA não retornou sugestões. Tente novamente.');
  }

  // biome-ignore lint/suspicious/noExplicitAny: tool input is dynamic JSON
  const raw = toolBlock.input as any;

  const sugestoes: Sugestao[] = Array.isArray(raw.sugestoes)
    ? // biome-ignore lint/suspicious/noExplicitAny: iterating dynamic JSON array
      raw.sugestoes.map((s: any) => ({
        titulo: String(s.titulo ?? '').slice(0, 80),
        descricao: s.descricao ? String(s.descricao).slice(0, 200) : null,
        projeto_id_sugerido: s.projeto_id_sugerido ? String(s.projeto_id_sugerido) : null,
        importancia: Math.round(Math.min(100, Math.max(0, Number(s.importancia ?? 50)))),
        urgencia: Math.round(Math.min(100, Math.max(0, Number(s.urgencia ?? 50)))),
        facilidade: Math.round(Math.min(100, Math.max(0, Number(s.facilidade ?? 50)))),
        razao_caminho_critico: String(s.razao_caminho_critico ?? '').slice(0, 180),
      }))
    : [];

  return {
    sugestoes,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      // biome-ignore lint/suspicious/noExplicitAny: extended usage fields from caching
      cache_creation_input_tokens: (response.usage as any).cache_creation_input_tokens ?? 0,
      // biome-ignore lint/suspicious/noExplicitAny: extended usage fields from caching
      cache_read_input_tokens: (response.usage as any).cache_read_input_tokens ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// classificarTarefa
// ---------------------------------------------------------------------------

export interface ClassificarTarefaInput {
  titulo: string;
  descricao?: string | null;
  projeto?: string | null;
  dataVencimento?: string | null;
  criteriosSucesso?: Record<string, unknown> | null;
  projetos?: Projeto[];
  tags?: Tag[];
  apiKey?: string;
  modelo?: string;
}

export async function classificarTarefa(
  input: ClassificarTarefaInput,
): Promise<ClassificacaoMeta> {
  const resolvedKey = input.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!resolvedKey) {
    throw new Error(
      'Configure sua chave Claude em /configuracoes para usar a classificação por IA.',
    );
  }

  const anthropic = new Anthropic({ apiKey: resolvedKey });
  const modelo = input.modelo ?? MODELO_DEFAULT;

  const ctx: ContextoClassificacao = {
    titulo: input.titulo,
    descricao: input.descricao,
    projeto: input.projeto,
    dataVencimento: input.dataVencimento,
    criteriosSucesso: input.criteriosSucesso,
    projetos: input.projetos ?? [],
    tags: input.tags ?? [],
  };

  const { system, userMessage, tool } = montarPromptClassificacao(ctx);

  const response = await anthropic.messages.create({
    model: modelo,
    max_tokens: MAX_TOKENS,
    // SDK aceita array de ContentBlockParam com cache_control — types ainda em catch-up
    // biome-ignore lint/suspicious/noExplicitAny: SDK types for system array with cache_control
    system: system as any,
    tools: [tool],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('IA não retornou classificação. Tente novamente.');
  }

  // biome-ignore lint/suspicious/noExplicitAny: tool input is dynamic JSON
  const raw = toolBlock.input as any;
  const importancia = Number(raw.importancia);
  const urgencia = Number(raw.urgencia);
  const facilidade = Number(raw.facilidade);

  if (Number.isNaN(importancia) || Number.isNaN(urgencia) || Number.isNaN(facilidade)) {
    throw new Error('Resposta da IA com valores inválidos. Tente novamente.');
  }

  return {
    importancia: Math.round(Math.min(100, Math.max(0, importancia))),
    urgencia: Math.round(Math.min(100, Math.max(0, urgencia))),
    facilidade: Math.round(Math.min(100, Math.max(0, facilidade))),
    tags_sugeridas: Array.isArray(raw.tags_sugeridas) ? (raw.tags_sugeridas as string[]) : [],
    explicacao: String(raw.explicacao ?? '').slice(0, 140),
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      // biome-ignore lint/suspicious/noExplicitAny: extended usage fields from caching
      cache_creation_input_tokens: (response.usage as any).cache_creation_input_tokens ?? 0,
      // biome-ignore lint/suspicious/noExplicitAny: extended usage fields from caching
      cache_read_input_tokens: (response.usage as any).cache_read_input_tokens ?? 0,
    },
  };
}
