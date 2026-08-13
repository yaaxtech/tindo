import type { Json } from '@/types/database';

/**
 * Converte um objeto de domínio já serializável para o tipo `Json` das colunas
 * `jsonb` do Supabase.
 *
 * Por que existe: o TypeScript só dá índice implícito (`{ [k: string]: ... }`)
 * a *type aliases*, nunca a `interface`. Então uma interface do domínio —
 * `ClassificacaoMeta`, `QuebraTarefaResult`, `Sugestao` — nunca é atribuível a
 * `Json`, mesmo quando todos os seus campos são JSON puro. Esta função
 * centraliza essa conversão num lugar só, em vez de espalhar `as unknown as Json`
 * pelos serviços e rotas.
 *
 * Regra de uso: só passe valores que realmente sejam serializáveis em JSON —
 * sem `Date`, `Map`, `Set`, função ou `undefined` no meio.
 */
export function paraJson<T>(valor: T): Json {
  return valor as unknown as Json;
}
