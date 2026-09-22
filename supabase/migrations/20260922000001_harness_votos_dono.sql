-- PREPARADA, NÃO APLICADA (gate de migration). Nota 👍/👎 do dono por tarefa do harness.
create table if not exists public.harness_votos_dono (
  id uuid primary key default gen_random_uuid(),
  tarefa_id text not null,
  voto smallint not null check (voto in (-1, 1)),
  criado_em timestamptz not null default now(),
  usuario_id uuid not null default auth.uid()
);

create index if not exists harness_votos_dono_tarefa_idx on public.harness_votos_dono (tarefa_id);

alter table public.harness_votos_dono enable row level security;

drop policy if exists harness_votos_dono_leitura on public.harness_votos_dono;
create policy harness_votos_dono_leitura on public.harness_votos_dono
  for select to authenticated using (true);

-- Escrita só pelo dono (auth.uid() fixo). Leitura: qualquer autenticado.
-- TODO(gate): confirmar o uid do dono antes de aplicar.
drop policy if exists harness_votos_dono_escrita on public.harness_votos_dono;
create policy harness_votos_dono_escrita on public.harness_votos_dono
  for insert to authenticated
  with check (auth.uid() = usuario_id and auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid);
