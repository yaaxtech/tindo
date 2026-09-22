-- PREPARADA, NÃO APLICADA (gate de migration).
-- Respostas do dono no Painel do Harness: aprovação de proposta e voto 👍/👎 por tarefa.
-- O motor lê as linhas com aplicado_em nulo, aplica e preenche aplicado_em.
create table if not exists public.harness_respostas_dono (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('aprovacao', 'voto')),
  alvo_id text not null,
  valor smallint not null check (valor in (-1, 1)),
  criado_em timestamptz not null default now(),
  aplicado_em timestamptz null,
  unique (tipo, alvo_id)
);

alter table public.harness_respostas_dono enable row level security;

-- Dono: o repo não guarda o uid dele; o app identifica o dono pelo e-mail
-- (src/lib/auth/routes.ts). TODO(gate): trocar pelo auth.uid() real antes de aplicar.
create or replace function public.harness_eh_dono() returns boolean
  language sql stable
as $$
  select auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid
      or lower(coalesce(auth.jwt() ->> 'email', '')) = 'falecomseucamarao@gmail.com'
$$;

drop policy if exists harness_respostas_dono_leitura on public.harness_respostas_dono;
create policy harness_respostas_dono_leitura on public.harness_respostas_dono
  for select to authenticated using (true);

drop policy if exists harness_respostas_dono_insert on public.harness_respostas_dono;
create policy harness_respostas_dono_insert on public.harness_respostas_dono
  for insert to authenticated with check (public.harness_eh_dono());

drop policy if exists harness_respostas_dono_update on public.harness_respostas_dono;
create policy harness_respostas_dono_update on public.harness_respostas_dono
  for update to authenticated using (public.harness_eh_dono()) with check (public.harness_eh_dono());
