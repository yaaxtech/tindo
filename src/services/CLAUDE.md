# Services — única ponte entre código e Supabase

> Este arquivo carrega quando o cwd inclui `src/services/`. Complementa
> `src/CLAUDE.md` e a seção REGRAS DE BANCO do CLAUDE.md raiz.
> Portado do padrão YaaX (2026-07-30) e adaptado ao TinDo: single-user
> (`usuario_id`, não `organizacao_id`/multi-tenant).

## REGRAS

- **Singleton:** `src/lib/supabase/{client,server}.ts` — não criar instâncias novas.
- **RLS isola por `usuario_id`** automaticamente. Mas SEMPRE filtre
  `deleted_at` (soft delete) também:
  ```ts
  .from('tabela').select('*').is('deleted_at', null)
  ```
- **Tipos em `src/types/`** espelham o schema (snake_case nas colunas do
  banco, camelCase nos objetos de domínio).
- **Erro de negócio sai TIPADO**, de `@/lib/api/erros` (`ErroValidacao`,
  `ErroSemPermissao`, `ErroNaoEncontrado`…). O status HTTP vem do tipo; a rota
  não olha mais o texto da mensagem. `throw new Error('...')` solto vira 500
  genérico e a mensagem NÃO chega ao usuário — o que é o certo para falha de
  banco, e errado para regra de negócio.

## NUNCA

- Acessar `supabase-js`/`createClient()` fora desta pasta — componentes chamam
  services, não o cliente direto.
- **DELETE físico** em dados operacionais — sempre `update({ deleted_at: now })`.
- Persistir a `nota` (0-100) sem recalcular — ela é sempre derivada (RN-03).
- Hardcode de `usuario_id` em queries — confie no RLS (exceto no contexto
  single-user MVP com `TINDO_MVP_USER_ID`, ver `ESTADO_ATUAL.md`, que é uma
  ponte temporária, não um padrão a copiar em código novo).

## PADRÕES DE DADOS (recorrentes)

- **Bulk-fetch para listagens:** prefira `get*ByMultiple*`/`get*ByIds`
  retornando `Map` a 1 query por linha (ex.: montar a fila com projetos/tags
  já resolvidos, não N+1).
- **PostgREST trunca em 1000 linhas** mesmo com `.limit(5000)`. Se algum dia o
  volume de tarefas/histórico crescer além disso: paginar com `.range()` ou
  agregar no banco via RPC — nunca confiar em batch central pra totais.
- **View pesada sob RLS pode estourar timeout** em volume grande → RPC
  `SECURITY DEFINER` com guard explícito de `usuario_id` (nunca sem guard —
  `SECURITY DEFINER` ignora RLS por padrão). Diagnostique como o usuário
  real, nunca `service_role` (que ignora RLS e não reproduz o problema).
- **`count: 'exact'` sob RLS em tabela grande pode ser lento** — prefira
  contagem via RPC agregada se `historico_acoes` crescer muito.

## TESTES

- Mock o cliente em `services/__mocks__/` (ou o padrão já usado nos testes
  existentes, ex. `kpis-adiamento.test.ts`).
- **Nunca rodar testes contra produção** (Supabase real) em CI.
- **Fake permissivo dá falso verde:** valide o rig de teste por mutação
  (quebre de propósito e confirme que o teste falha) antes de confiar nele.
