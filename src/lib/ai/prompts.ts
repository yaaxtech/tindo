import type { Projeto, Tag } from '@/types/domain';

export interface Classificacao {
  importancia: number;
  urgencia: number;
  facilidade: number;
  tags_sugeridas: string[];
  explicacao: string;
}

export interface ClassificacaoMeta extends Classificacao {
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
}

export interface ContextoClassificacao {
  criteriosSucesso?: Record<string, unknown> | null;
  projetos: Projeto[];
  tags: Tag[];
  titulo: string;
  descricao?: string | null;
  projeto?: string | null;
  dataVencimento?: string | null;
}

export const TOOL_CLASSIFICAR_TAREFA = {
  name: 'classificar_tarefa',
  description:
    'Classifica uma tarefa retornando importancia, urgencia, facilidade (0-100), tags sugeridas e uma explicacao curta.',
  input_schema: {
    type: 'object' as const,
    properties: {
      importancia: {
        type: 'number',
        description: 'Valor de 0 a 100 indicando o impacto da tarefa nos objetivos do usuário.',
        minimum: 0,
        maximum: 100,
      },
      urgencia: {
        type: 'number',
        description:
          'Valor de 0 a 100. 100 = prazo imediato ou bloqueante, 0 = sem prazo / pode aguardar.',
        minimum: 0,
        maximum: 100,
      },
      facilidade: {
        type: 'number',
        description: 'Valor de 0 a 100. 100 = tarefa trivial (<2 min), 0 = complexíssima.',
        minimum: 0,
        maximum: 100,
      },
      tags_sugeridas: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs das tags disponíveis que se aplicam à tarefa. Pode ser vazio.',
      },
      explicacao: {
        type: 'string',
        description: 'Explicação curta (≤140 chars) justificando a classificação.',
        maxLength: 140,
      },
    },
    required: ['importancia', 'urgencia', 'facilidade', 'tags_sugeridas', 'explicacao'],
  },
} as const;

function buildListaProjetos(projetos: Projeto[]): string {
  if (projetos.length === 0) return 'Nenhum projeto cadastrado.';
  return projetos
    .filter((p) => p.ativo)
    .sort((a, b) => a.ordemPrioridade - b.ordemPrioridade)
    .map(
      (p, i) =>
        `${i + 1}. ${p.nome} (multiplicador: ${p.multiplicador}x, prioridade: ${p.ordemPrioridade})`,
    )
    .join('\n');
}

function buildListaTags(tags: Tag[]): string {
  if (tags.length === 0) return 'Nenhuma tag cadastrada.';
  return tags
    .filter((t) => t.ativo)
    .map((t) => `- id=${t.id} nome="${t.nome}" tipo_peso=${t.tipoPeso} valor=${t.valorPeso}`)
    .join('\n');
}

function buildCriterios(criteriosSucesso?: Record<string, unknown> | null): string {
  if (!criteriosSucesso) return 'Nenhum critério de sucesso definido. Use bom senso.';
  try {
    return JSON.stringify(criteriosSucesso, null, 2);
  } catch {
    return 'Critérios definidos pelo usuário.';
  }
}

export interface MontarSystemInput {
  criteriosSucesso?: Record<string, unknown> | null;
  projetos: Projeto[];
  tags: Tag[];
}

export function montarSystem(input: MontarSystemInput): Array<{
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}> {
  const staticBlock = `Projetos do usuário (em ordem de prioridade):
${buildListaProjetos(input.projetos)}

Tags disponíveis (use os IDs exatos em tags_sugeridas):
${buildListaTags(input.tags)}

Critérios de sucesso do usuário:
${buildCriterios(input.criteriosSucesso)}`;

  return [
    {
      type: 'text' as const,
      text: 'Você é o classificador de tarefas do TinDo. Seu papel é analisar uma tarefa e retornar, via tool_use, os valores de importância, urgência e facilidade (0-100), as tags que se aplicam e uma explicação curta.\n\nRegras:\n- importancia: impacto nos critérios de sucesso do usuário (100 = resolve objetivo principal)\n- urgencia: proximidade do prazo e consequências de atraso (100 = hoje/bloqueante)\n- facilidade: inverso da complexidade (100 = trivial <2min; 0 = enorme)\n- tags_sugeridas: somente IDs das tags listadas abaixo\n- explicacao: ≤140 chars, objetivo, em português',
    },
    {
      type: 'text' as const,
      text: staticBlock,
      cache_control: { type: 'ephemeral' as const },
    },
  ];
}

export function montarPromptClassificacao(ctx: ContextoClassificacao): {
  system: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  userMessage: string;
  tool: typeof TOOL_CLASSIFICAR_TAREFA;
} {
  const lines: string[] = [`Classifique esta tarefa:`, `- Título: ${ctx.titulo}`];

  if (ctx.descricao) lines.push(`- Descrição: ${ctx.descricao}`);
  if (ctx.projeto) lines.push(`- Projeto: ${ctx.projeto}`);
  if (ctx.dataVencimento) lines.push(`- Data de vencimento: ${ctx.dataVencimento}`);

  return {
    system: montarSystem({
      criteriosSucesso: ctx.criteriosSucesso,
      projetos: ctx.projetos,
      tags: ctx.tags,
    }),
    userMessage: lines.join('\n'),
    tool: TOOL_CLASSIFICAR_TAREFA,
  };
}
