-- Perfil básico da conta. WhatsApp é privado e serve somente para suporte.
-- A cor identifica a pessoa em avatares e, futuramente, em presença/cursores.

create table public.perfis_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references auth.users(id) on delete cascade,
  nome varchar(80) not null,
  whatsapp varchar(30) null,
  cor varchar(7) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  check (cor in ('#2CAF93', '#4C8DFF', '#A879E8', '#E58A45', '#E15D75', '#36A7B4', '#C49A32', '#7E9E45'))
);

create trigger set_updated_at before update on public.perfis_usuario
  for each row execute function public.set_updated_at();

alter table public.perfis_usuario enable row level security;
create policy perfis_usuario_owner on public.perfis_usuario
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  cores constant text[] := array[
    '#2CAF93', '#4C8DFF', '#A879E8', '#E58A45',
    '#E15D75', '#36A7B4', '#C49A32', '#7E9E45'
  ];
  nome_inicial text;
begin
  nome_inicial := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'Pessoa'), '@', 1)
  );

  insert into public.perfis_usuario (usuario_id, nome, whatsapp, cor)
  values (
    new.id,
    left(nome_inicial, 80),
    nullif(trim(new.raw_user_meta_data ->> 'whatsapp'), ''),
    cores[1 + floor(random() * array_length(cores, 1))::int]
  )
  on conflict (usuario_id) do nothing;
  return new;
end;
$$;

create trigger criar_perfil_apos_cadastro
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- Contas anteriores à migration também recebem perfil e cor.
insert into public.perfis_usuario (usuario_id, nome, whatsapp, cor)
select
  u.id,
  left(coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(u.email, 'Pessoa'), '@', 1)
  ), 80),
  nullif(trim(u.raw_user_meta_data ->> 'whatsapp'), ''),
  (array['#2CAF93', '#4C8DFF', '#A879E8', '#E58A45', '#E15D75', '#36A7B4', '#C49A32', '#7E9E45'])[
    1 + floor(random() * 8)::int
  ]
from auth.users u
on conflict (usuario_id) do nothing;
