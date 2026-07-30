// RoadMapMind — tipos de domínio da árvore de nós (outline + mindmap).
// Espelham a tabela `doc_linhas` (snake_case no banco → camelCase aqui).
// Ver spec: docs/superpowers/plans/2026-07-30-roadmapmind-fase-1-mvp.md

export type TipoLinha = 'texto' | 'tarefa' | 'codigo';
export type TarefaEstado = 'aberta' | 'concluida';
export type ModoLista = 'herdado' | 'marcadores' | 'numeros';

/** Uma linha do outline = um nó da árvore = um bloco do BlockNote (id estável). */
export interface DocLinha {
  id: string; // uuid — mesmo id do bloco BlockNote
  paiId: string | null; // NULL só na raiz do usuário
  ordem: string; // fractional index (ordenável lexicograficamente)
  conteudo: unknown[]; // inline content BlockNote (jsonb) — fonte do editor
  textoMd: string; // derivado no write: markdown p/ IA/busca/export
  tipo: TipoLinha;
  tarefaEstado: TarefaEstado | null; // não-nulo sse, e só se, tipo === 'tarefa'
  modoLista: ModoLista;
}
