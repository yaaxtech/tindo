/**
 * Prompt da triagem da Entrada do Todoist.
 *
 * Diferente de `classificar_tarefa` (que devolve importância/urgência/facilidade
 * para a nota do TinDo), aqui a IA decide o que o Emanuel faria à mão ao
 * classificar a Entrada: lembrete x tarefa, projeto, etiquetas, prioridade e
 * quando. Ela aprende pelos exemplos de tarefas que ele já classificou.
 */

export const QUANDO_OPCOES = [
  'hoje_manha',
  'hoje_tarde',
  'hoje_noite',
  'amanha',
  'proxima_semana',
  'sem_data',
] as const;
export type Quando = (typeof QUANDO_OPCOES)[number];

export interface RespostaTriagem {
  tipo: 'lembrete' | 'tarefa';
  projeto_id: string | null;
  etiquetas: string[];
  /** Prioridade visual do Todoist: 1 = P1 (mais alta) … 4 = P4. */
  prioridade: 1 | 2 | 3 | 4;
  quando: Quando;
  /** id de uma tarefa existente que é a mesma frente (para encaixar/mesclar). */
  frente_existente_id: string | null;
  /** 0 a 1: quão segura a IA está do projeto e das etiquetas. */
  confianca: number;
  explicacao: string;
}

export const TOOL_TRIAR_ENTRADA = {
  name: 'triar_entrada',
  description: 'Classifica um item da Entrada do Todoist como o usuário faria à mão.',
  input_schema: {
    type: 'object' as const,
    properties: {
      tipo: {
        type: 'string',
        enum: ['lembrete', 'tarefa'],
        description:
          'lembrete = operacional, até 2 minutos (ver, verificar, falar, cobrar). tarefa = mais longa ou estratégica.',
      },
      projeto_id: {
        type: ['string', 'null'],
        description: 'id de um dos projetos listados, ou null se não houver um claro.',
      },
      etiquetas: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 4,
        description:
          'Somente nomes de etiquetas que já existem na lista. Inclua a etiqueta do projeto quando o usuário costuma usar.',
      },
      prioridade: {
        type: 'integer',
        enum: [1, 2, 3, 4],
        description: 'P1 = mais alta, P4 = sem prioridade. Siga o padrão dos exemplos.',
      },
      quando: {
        type: 'string',
        enum: [...QUANDO_OPCOES],
        description: 'Para lembretes, o turno mais provável. Para tarefas sem data, use sem_data.',
      },
      frente_existente_id: {
        type: ['string', 'null'],
        description:
          'id de uma tarefa existente da lista "frentes abertas" que é claramente a mesma frente; senão null.',
      },
      confianca: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Quão seguro você está de projeto e etiquetas (0 a 1). Seja honesto.',
      },
      explicacao: { type: 'string', maxLength: 140, description: 'Motivo curto, em português.' },
    },
    required: [
      'tipo',
      'projeto_id',
      'etiquetas',
      'prioridade',
      'quando',
      'frente_existente_id',
      'confianca',
      'explicacao',
    ],
  },
} as const;

export interface ExemploClassificado {
  conteudo: string;
  projeto: string;
  etiquetas: string[];
  prioridade: 1 | 2 | 3 | 4;
}

export interface FrenteAberta {
  id: string;
  conteudo: string;
}

export interface ContextoTriagem {
  projetos: Array<{ id: string; nome: string }>;
  etiquetas: string[];
  exemplos: ExemploClassificado[];
  frentes: FrenteAberta[];
}

const REGRAS = `Você faz a triagem da caixa de entrada do Todoist do Emanuel.

Regras dele:
- LEMBRETE: coisa de até 2 minutos, operacional, com dia/turno (ver, verificar, falar, cobrar alguém).
- TAREFA: mais de 2 minutos, normalmente estratégica; pode não ter data, mas precisa de prioridade bem definida.
- Todo projeto tem uma etiqueta própria; siga os exemplos para saber qual etiqueta acompanha cada projeto.
- EM.Coop: responsabilidade dividida com o companheiro. EM.Acomp: ele só acompanha algo de outra pessoa.
- Frentes com dependência usam o formato "sub-projeto ! passo 1 / passo 2 / passo 3". Se o item novo for claramente um passo de uma frente aberta, informe o id dela em frente_existente_id.
- Nunca invente projeto ou etiqueta: use só os que estão nas listas.
- Na dúvida, baixe a confiança em vez de chutar.`;

export function montarSystemTriagem(ctx: ContextoTriagem): Array<{
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}> {
  const projetos = ctx.projetos.map((p) => `- id=${p.id} "${p.nome}"`).join('\n');
  const etiquetas = ctx.etiquetas.join(', ') || '(nenhuma)';
  const exemplos =
    ctx.exemplos
      .map(
        (e) =>
          `- "${e.conteudo}" → projeto "${e.projeto}", P${e.prioridade}, etiquetas [${e.etiquetas.join(', ')}]`,
      )
      .join('\n') || '(sem exemplos)';
  const frentes = ctx.frentes.map((f) => `- id=${f.id} "${f.conteudo}"`).join('\n') || '(nenhuma)';

  return [
    { type: 'text', text: REGRAS },
    {
      type: 'text',
      text: `Projetos:\n${projetos}\n\nEtiquetas existentes:\n${etiquetas}\n\nExemplos de itens que ele já classificou:\n${exemplos}\n\nFrentes abertas (formato "sub-projeto ! ..."):\n${frentes}`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

export function montarMensagemTriagem(item: {
  conteudo: string;
  descricao?: string | null;
  data?: string | null;
}): string {
  const linhas = ['Faça a triagem deste item da Entrada:', `- Texto: ${item.conteudo}`];
  if (item.descricao) linhas.push(`- Descrição: ${item.descricao}`);
  if (item.data) linhas.push(`- Data já colocada: ${item.data}`);
  return linhas.join('\n');
}

/** Converte o JSON cru do tool_use numa resposta válida (valores fora do contrato caem no padrão). */
export function lerRespostaTriagem(raw: Record<string, unknown>): RespostaTriagem {
  const prioridade = Number(raw.prioridade);
  const quando = String(raw.quando ?? '');
  return {
    tipo: raw.tipo === 'lembrete' ? 'lembrete' : 'tarefa',
    projeto_id: typeof raw.projeto_id === 'string' && raw.projeto_id ? raw.projeto_id : null,
    etiquetas: Array.isArray(raw.etiquetas) ? raw.etiquetas.map(String).slice(0, 4) : [],
    prioridade: [1, 2, 3, 4].includes(prioridade) ? (prioridade as 1 | 2 | 3 | 4) : 4,
    quando: (QUANDO_OPCOES as readonly string[]).includes(quando) ? (quando as Quando) : 'sem_data',
    frente_existente_id:
      typeof raw.frente_existente_id === 'string' && raw.frente_existente_id
        ? raw.frente_existente_id
        : null,
    confianca: Math.min(1, Math.max(0, Number(raw.confianca) || 0)),
    explicacao: String(raw.explicacao ?? '').slice(0, 140),
  };
}
