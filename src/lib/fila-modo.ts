import type { Tarefa } from '@/types/domain';

/** Modos da fila em /cards: só lembretes (matar rápido), só tarefas, ou tudo. */
export type ModoFila = 'todos' | 'lembretes' | 'tarefas';

export const MODOS_FILA: ReadonlyArray<{ id: ModoFila; rotulo: string }> = [
  { id: 'lembretes', rotulo: 'Lembretes' },
  { id: 'tarefas', rotulo: 'Tarefas' },
  { id: 'todos', rotulo: 'Tudo' },
];

export function filtrarPorModo(fila: Tarefa[], modo: ModoFila): Tarefa[] {
  if (modo === 'lembretes') return fila.filter((t) => t.tipo === 'lembrete');
  if (modo === 'tarefas') return fila.filter((t) => t.tipo !== 'lembrete');
  return fila;
}

export function ehModoFila(v: unknown): v is ModoFila {
  return v === 'todos' || v === 'lembretes' || v === 'tarefas';
}
