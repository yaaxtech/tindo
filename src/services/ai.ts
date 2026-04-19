import Anthropic from '@anthropic-ai/sdk';
import {
  type ClassificacaoMeta,
  type ContextoClassificacao,
  montarPromptClassificacao,
} from '@/lib/ai/prompts';
import type { Projeto, Tag } from '@/types/domain';

export type { Classificacao, ClassificacaoMeta } from '@/lib/ai/prompts';

const MODELO_DEFAULT = 'claude-sonnet-4-6';
const MAX_TOKENS = 256;

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
