import type { TodoistTask } from './client';

/**
 * Converte a prioridade do Todoist para a do TinDo.
 * Todoist: 4 = mais urgente (P1 visual), 1 = normal (P4 visual).
 * TinDo:   1 = mais urgente, 4 = padrão.
 */
export function prioridadeTodoistParaTinDo(p: TodoistTask['priority']): 1 | 2 | 3 | 4 {
  const mapa: Record<1 | 2 | 3 | 4, 1 | 2 | 3 | 4> = { 4: 1, 3: 2, 2: 3, 1: 4 };
  return mapa[p];
}

export function prioridadeTinDoParaTodoist(p: 1 | 2 | 3 | 4): 1 | 2 | 3 | 4 {
  const mapa: Record<1 | 2 | 3 | 4, 1 | 2 | 3 | 4> = { 1: 4, 2: 3, 3: 2, 4: 1 };
  return mapa[p];
}

/**
 * Labels que marcam LEMBRETE (case-insensitive).
 */
const LABELS_LEMBRETE = ['lembretes', 'lembrete', 'fazer 2min', 'criar /', 'criar todo'];

/**
 * Labels que marcam TAREFA (case-insensitive).
 */
const LABELS_TAREFA = ['todo'];

/**
 * Labels que marcam "não mostrar no TinDo" (case-insensitive).
 * Inclui variações de capitalização que o usuário usa no Todoist.
 */
const LABELS_EXCLUIR = [
  'em.inativo',
  'em.naoaparecer',
  'em.naoaparecertodo',
  'naoaparecerlembretes',
];

/**
 * Padrões de nome de projeto (substring, case-insensitive) → tipo TinDo.
 * Ordem importa: primeiro match vence. Mais específico (lembretes) vem antes.
 */
const PADROES_PROJETO_LEMBRETE = [
  'lembrete', // qualquer projeto com "lembrete" no nome
  'falar ou ativ', // "1. ⏲Falar ou Ativ. Rapidas"
  'ativ. rapidas',
  'ativ rapidas',
];

const PADROES_PROJETO_TAREFA = [
  '| todo', // "2. Maioli | ToDo"
  '| to do',
  ' todo',
];

export interface TipoContext {
  labels: string[];
  projetoNome?: string | null;
}

export function deriveTipo({ labels, projetoNome }: TipoContext): 'tarefa' | 'lembrete' | null {
  const labelsLower = labels.map((l) => l.toLowerCase().trim());

  // 1) Label de exclusão sempre vence.
  if (labelsLower.some((l) => LABELS_EXCLUIR.includes(l))) return null;

  // 2) Label explícita de lembrete.
  if (labelsLower.some((l) => LABELS_LEMBRETE.includes(l))) return 'lembrete';

  // 3) Label explícita de tarefa.
  if (labelsLower.some((l) => LABELS_TAREFA.includes(l))) return 'tarefa';

  // 4) Nome de projeto.
  if (projetoNome) {
    const nomeLower = projetoNome.toLowerCase();
    for (const p of PADROES_PROJETO_LEMBRETE) {
      if (nomeLower.includes(p)) return 'lembrete';
    }
    for (const p of PADROES_PROJETO_TAREFA) {
      if (nomeLower.includes(p)) return 'tarefa';
    }
  }

  // 5) Sem match: ignorar.
  return null;
}

export function extrairDataVencimento(task: TodoistTask): string | null {
  return task.due?.date ?? null;
}

export function extrairPrazoConclusao(task: TodoistTask): string | null {
  return task.deadline?.date ?? null;
}
