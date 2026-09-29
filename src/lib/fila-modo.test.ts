import type { Tarefa } from '@/types/domain';
import { describe, expect, it } from 'vitest';
import { ehModoFila, filtrarPorModo } from './fila-modo';

const t = (id: string, tipo: Tarefa['tipo'] | null) => ({ id, tipo }) as Tarefa;
const fila = [t('a', 'lembrete'), t('b', 'tarefa'), t('c', null)];

describe('filtrarPorModo', () => {
  it('lembretes mostra só lembretes', () => {
    expect(filtrarPorModo(fila, 'lembretes').map((x) => x.id)).toEqual(['a']);
  });
  it('tarefas mostra o resto (inclui sem classificação)', () => {
    expect(filtrarPorModo(fila, 'tarefas').map((x) => x.id)).toEqual(['b', 'c']);
  });
  it('todos mantém tudo', () => {
    expect(filtrarPorModo(fila, 'todos')).toHaveLength(3);
  });
  it('valida modo', () => {
    expect(ehModoFila('lembretes')).toBe(true);
    expect(ehModoFila('x')).toBe(false);
  });
});
