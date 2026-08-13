-- Tempos crus do GitHub Actions para o Painel do Harness.
-- Uma linha por workflow_run, com TIMESTAMPS CRUS (nada pré-calculado): os
-- segmentos (fila de CI, execução, espera de merge, deploy) são derivados na
-- lib pura src/lib/harness/github-timings.ts, então a análise pode mudar sem
-- recoletar nada.
--
-- Convenções que NÃO se aplicam aqui (dado de orquestração, não de usuário):
--   * sem usuario_id — mesmo caso de harness_snapshot (20260804000001);
--   * PK não é uuid: é o run_id do próprio GitHub, para que a coleta diária
--     seja idempotente por upsert (o coletor rebusca sempre 90 dias);
--   * sem deleted_at — não há operação de exclusão nesta tabela.
--
-- PRIVACIDADE: /harness é PÚBLICA (leitura anon, ver 20260804000003). Por isso
-- esta tabela guarda só identificadores e horários — NUNCA título de PR,
-- mensagem de commit ou qualquer texto livre.
create table if not exists public.harness_github_runs (
  run_id        bigint primary key,
  repo          text not null,
  evento        varchar(20) not null
                constraint harness_github_runs_evento_check
                check (evento in ('pull_request', 'push')),
  branch        text,
  head_sha      text,
  -- success | failure | cancelled | skipped | timed_out | action_required |
  -- neutral | stale | startup_failure — null enquanto o run ainda não terminou.
  conclusao     varchar(30),
  criado_em     timestamptz not null,
  iniciado_em   timestamptz,
  atualizado_em timestamptz,
  pr_numero     integer,
  pr_criado_em  timestamptz,
  pr_merged_em  timestamptz,
  coletado_em   timestamptz not null default now()
);

-- Recorte por janela é sempre "repo + últimos N dias".
create index if not exists harness_github_runs_repo_criado_idx
  on public.harness_github_runs (repo, criado_em desc);

-- Casar run verde ↔ merge do PR passa pelo head_sha.
create index if not exists harness_github_runs_head_sha_idx
  on public.harness_github_runs (head_sha);

alter table public.harness_github_runs enable row level security;

-- Leitura pública (o painel é público). Escrita: só service_role, que
-- ignora RLS — nenhuma policy de INSERT/UPDATE/DELETE é criada de propósito.
drop policy if exists harness_github_runs_read on public.harness_github_runs;
create policy harness_github_runs_read on public.harness_github_runs
  for select to anon, authenticated using (true);
