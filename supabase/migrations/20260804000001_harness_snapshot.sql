-- Painel do Harness: snapshot singleton empurrado pela máquina do dono.
-- Dado de orquestração (não multi-usuário) → sem usuario_id.
-- Leitura: qualquer usuário autenticado (TinDo é single-user hoje; se virar
-- multi-user, restringir ao uuid do dono). Escrita: só service_role.
create table if not exists public.harness_snapshot (
  id         text primary key default 'singleton'
             constraint harness_snapshot_singleton check (id = 'singleton'),
  dados      jsonb not null,
  gerado_em  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.harness_snapshot enable row level security;

drop policy if exists harness_snapshot_read on public.harness_snapshot;
create policy harness_snapshot_read on public.harness_snapshot
  for select to authenticated using (true);
