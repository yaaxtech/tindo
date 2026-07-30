# Migrations Supabase — convenções obrigatórias

> Este arquivo carrega quando o cwd inclui `supabase/migrations/`. Complementa
> a seção REGRAS DE BANCO do CLAUDE.md raiz (que já define as convenções
> exatas do TinDo — uuid, `usuario_id`, soft delete, varchar+CHECK). Aqui vai
> o checklist pré-apply e os gotchas técnicos, portados do padrão YaaX
> (2026-07-30).

## CHECKLIST PRÉ-APPLY

- [ ] `usuario_id uuid NOT NULL REFERENCES auth.users(id)` presente?
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + policy `usuario_id = auth.uid()`?
- [ ] Índices em FKs (especialmente `usuario_id`)?
- [ ] Trigger `set_updated_at()` se a tabela tem `updated_at`?
- [ ] `deleted_at timestamptz NULL` para soft delete?
- [ ] Dinheiro/quantidade crítica é `numeric`, nunca `float`?
- [ ] Status é `varchar + CHECK`, não enum PostgreSQL?

## GOTCHAS TÉCNICOS (portáveis, aprendidos a custo alto em outro projeto)

- **Renomear coluna → auditar triggers SQL:** trigger PL/pgSQL referencia
  coluna por nome TEXTUAL: após rename ele compila e só falha em RUNTIME.
  Audite `pg_get_triggerdef` das tabelas afetadas NA MESMA migration (o
  TinDo já tem `set_updated_at()` em `tarefas`, `gamificacao`, `projetos`,
  `tags`, `configuracoes` e `espacos_trabalho` — ver os arquivos em
  `supabase/migrations/`).
- **`session_replication_role='replica'` NUNCA ao redor de DELETE/UPDATE:**
  sob `replica`, triggers de FK (CASCADE) e de usuário não disparam — o
  DELETE "funciona" e deixa órfãos. `replica` só em blocos exclusivamente de
  INSERT bulk-seed.
- **`CREATE INDEX CONCURRENTLY` NÃO roda em `supabase db push`** (transação
  implícita). Índice grande em tabela quente: aplicar via psql/Studio fora de
  transação + registrar manualmente em `schema_migrations`.
- **Toggle de feature nasce com default `false` NO CÓDIGO** — a ativação vive
  no seed/config do banco, sob OK do dono (ex.: `todoist_writeback_habilitado`
  já segue esse padrão no TinDo, default off). Merge de config: chave ausente
  ⇒ default hardcoded; default `true` liga a feature no deploy do frontend
  antes de qualquer migration.

## MIGRATIONS DE DADOS EM MASSA (>1k linhas)

1. **Auditar CHECK + unique** da tabela antes do batch.
2. **Validar 3 linhas manualmente com o dono** antes de rodar o batch.
3. **Confirmar a coluna alvo** (tipo e semântica) antes de qualquer UPDATE.
4. **Checar `usuario_id`** em qualquer escrita — não vazar entre usuários
   quando o TinDo virar multi-user (ver `docs/09_ROADMAP.md` Fase 12+).
5. **Audit que descobre erro de dados = motivo para REJEITAR** a migration
   até confirmar com o dono — não aplicar só porque está "pronta".
6. **Dry-run em `BEGIN…ROLLBACK`** com contagens antes/depois impressas.
