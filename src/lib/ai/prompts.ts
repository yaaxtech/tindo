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

// ---------------------------------------------------------------------------
// Fase D — Quebra de Tarefas
// ---------------------------------------------------------------------------

export interface ContextoQuebra {
  titulo: string;
  descricao?: string | null;
  projeto?: string | null;
}

export const TOOL_QUEBRAR_TAREFA = {
  name: 'quebrar_tarefa',
  description:
    'Decide se uma tarefa deve ser quebrada em sub-tarefas e retorna a lista de sub-tarefas sugeridas.',
  input_schema: {
    type: 'object' as const,
    properties: {
      deve_quebrar: {
        type: 'boolean',
        description: 'true se a tarefa é grande o suficiente pra valer quebrar',
      },
      sub_tarefas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            titulo: { type: 'string', maxLength: 80 },
            descricao: { type: 'string', maxLength: 200 },
            facilidade_estimada: { type: 'number', minimum: 0, maximum: 100 },
          },
          required: ['titulo', 'descricao', 'facilidade_estimada'],
        },
      },
      explicacao: {
        type: 'string',
        maxLength: 140,
        description: 'Justificativa curta (≤140 chars) em português.',
      },
    },
    required: ['deve_quebrar', 'sub_tarefas', 'explicacao'],
  },
} as const;

export function montarPromptQuebra(ctx: ContextoQuebra): {
  system: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  userMessage: string;
  tool: typeof TOOL_QUEBRAR_TAREFA;
} {
  const systemText =
    'Você é o assistente de produtividade do TinDo. Seu papel é decidir se uma tarefa deve ser quebrada em sub-tarefas menores.\n\n' +
    'Regras:\n' +
    '- Só recomende quebrar se a tarefa envolver várias etapas distintas de 10+ minutos cada.\n' +
    '- Se a tarefa for trivial, simples ou bem delimitada, retorne deve_quebrar: false, sub_tarefas: [].\n' +
    '- Cada sub-tarefa deve ser autônoma e acionável.\n' +
    '- facilidade_estimada: 100 = trivial, 0 = complexa.\n' +
    '- Máximo de 6 sub-tarefas.\n' +
    '- Todos os textos em português.';

  const lines = ['Analise esta tarefa e decida se deve ser quebrada:', `- Título: ${ctx.titulo}`];
  if (ctx.descricao) lines.push(`- Descrição: ${ctx.descricao}`);
  if (ctx.projeto) lines.push(`- Projeto: ${ctx.projeto}`);

  return {
    system: [
      {
        type: 'text' as const,
        text: systemText,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    userMessage: lines.join('\n'),
    tool: TOOL_QUEBRAR_TAREFA,
  };
}

// ---------------------------------------------------------------------------
// Fase E — Sugestão de Novas Tarefas (Caminho Crítico)
// ---------------------------------------------------------------------------

export interface Sugestao {
  titulo: string;
  descricao?: string | null;
  projeto_id_sugerido?: string | null;
  importancia: number;
  urgencia: number;
  facilidade: number;
  razao_caminho_critico: string;
}

export const TOOL_SUGERIR_TAREFAS = {
  name: 'sugerir_tarefas',
  description:
    'Sugere novas tarefas que estão no caminho crítico para atingir os critérios de sucesso do usuário.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sugestoes: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            titulo: { type: 'string', maxLength: 80 },
            descricao: { type: 'string', maxLength: 200 },
            projeto_id_sugerido: {
              type: 'string',
              description: 'id do projeto ou null',
            },
            importancia: { type: 'number', minimum: 0, maximum: 100 },
            urgencia: { type: 'number', minimum: 0, maximum: 100 },
            facilidade: { type: 'number', minimum: 0, maximum: 100 },
            razao_caminho_critico: { type: 'string', maxLength: 180 },
          },
          required: [
            'titulo',
            'razao_caminho_critico',
            'importancia',
            'urgencia',
            'facilidade',
          ],
        },
      },
    },
    required: ['sugestoes'],
  },
} as const;

export interface ContextoSugestoes {
  criteriosSucesso?: Record<string, unknown> | null;
  projetos: Projeto[];
  tags: Tag[];
  ultimasConcluidas: string[]; // títulos das últimas 10 concluídas
  tarefasPendentesResumo: Array<{ projetoNome: string; count: number }>; // contagem por projeto
}

export function montarPromptSugestoes(ctx: ContextoSugestoes): {
  system: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  userMessage: string;
  tool: typeof TOOL_SUGERIR_TAREFAS;
} {
  const staticBlock =
    `Critérios de sucesso do usuário:\n${buildCriterios(ctx.criteriosSucesso)}\n\n` +
    `Projetos do usuário (em ordem de prioridade):\n${buildListaProjetos(ctx.projetos)}\n\n` +
    `Tags disponíveis:\n${buildListaTags(ctx.tags)}`;

  const system = [
    {
      type: 'text' as const,
      text:
        'Você é o assistente de produtividade estratégica do TinDo. Seu papel é analisar o contexto do usuário e sugerir até 5 NOVAS tarefas que ele ainda não tem na lista e que mais avançam os seus critérios de sucesso.\n\n' +
        'Regras:\n' +
        '- Sugira tarefas DIFERENTES das já existentes (pendentes e concluídas).\n' +
        '- Foque no caminho crítico: qual ação desbloquearia mais valor agora?\n' +
        '- importancia: impacto nos critérios de sucesso (100 = resolve objetivo principal).\n' +
        '- urgencia: proximidade de prazo ou bloqueio (100 = urgentíssimo).\n' +
        '- facilidade: inverso da complexidade (100 = trivial <2min; 0 = enorme).\n' +
        '- razao_caminho_critico: ≤180 chars, em português, explica por que essa tarefa é crítica agora.\n' +
        '- Se houver projeto_id relevante, informe. Caso contrário, omita o campo.\n' +
        '- Todos os textos em português.',
    },
    {
      type: 'text' as const,
      text: staticBlock,
      cache_control: { type: 'ephemeral' as const },
    },
  ];

  const linhasUltimas =
    ctx.ultimasConcluidas.length > 0
      ? ctx.ultimasConcluidas.map((t, i) => `${i + 1}. ${t}`).join('\n')
      : 'Nenhuma tarefa concluída ainda.';

  const linhasResumo =
    ctx.tarefasPendentesResumo.length > 0
      ? ctx.tarefasPendentesResumo
          .map((r) => `- ${r.projetoNome}: ${r.count} pendente(s)`)
          .join('\n')
      : 'Nenhuma tarefa pendente.';

  const userMessage =
    `Últimas 10 tarefas concluídas (mais recentes primeiro):\n${linhasUltimas}\n\n` +
    `Resumo de tarefas pendentes por projeto:\n${linhasResumo}\n\n` +
    'Com base nisso, sugira até 5 tarefas DIFERENTES das já listadas acima que mais avançam os critérios de sucesso do usuário.';

  return { system, userMessage, tool: TOOL_SUGERIR_TAREFAS };
}

// ---------------------------------------------------------------------------
// Classificação (original — mantida intacta abaixo)
// ---------------------------------------------------------------------------

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
