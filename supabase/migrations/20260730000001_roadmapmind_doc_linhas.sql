-- RoadMapMind — Fase 1 (MVP): árvore de nós do editor outline + mindmap.
-- Ticket 04 (schema). doc_espelhos (ticket 09) vem em migration separada (Fatia 7).
-- Convenções: uuid PK, usuario_id NOT NULL + RLS, soft delete, updated_at via trigger,
-- varchar+CHECK. set_updated_at() já existe (migration 20260417000001).

create table public.doc_linhas (
  id uuid primary key default gen_random_uuid(),        -- = id do bloco BlockNote (uuid gerado no cliente)
  usuario_id uuid not null references auth.users(id),   -- dono do documento-raiz
  pai_id uuid null references public.doc_linhas(id),    -- NULL só na raiz do usuário
  ordem text not null,                                  -- fractional index (ordenável lexicograficamente)
  conteudo jsonb not null default '[]'::jsonb,          -- inline content BlockNote (fonte do editor)
  texto_md text not null default '',                    -- derivado no write: markdown p/ IA/busca/export
  tipo varchar(20) not null default 'texto'
    check (tipo in ('texto','tarefa','codigo')),
  tarefa_estado varchar(20) null
    check (tarefa_estado in ('aberta','concluida')),
  modo_lista varchar(20) not null default 'herdado'
    check (modo_lista in ('herdado','marcadores','numeros')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  check ((tipo = 'tarefa') = (tarefa_estado is not null))
);

-- 1 raiz por usuário:
create unique index doc_linhas_uma_raiz on public.doc_linhas (usuario_id)
  where pai_id is null and deleted_at is null;
-- navegação e FKs:
create index doc_linhas_pai_ordem on public.doc_linhas (pai_id, ordem) where deleted_at is null;
create index doc_linhas_usuario on public.doc_linhas (usuario_id);

create trigger set_updated_at before update on public.doc_linhas
  for each row execute function public.set_updated_at();

alter table public.doc_linhas enable row level security;
create policy doc_linhas_owner on public.doc_linhas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ── RPCs ────────────────────────────────────────────────────────────────────
-- SECURITY INVOKER: com login real, a RLS aplica. No MVP o service usa service
-- role (bypassa RLS) e valida posse (usuario_id) ANTES de chamar cada RPC.

-- Serializa qualquer subárvore em markdown (IA/export). DFS pré-ordem via caminho de ordens.
create or replace function public.documento_como_markdown(p_linha uuid)
returns text language sql security invoker stable as $$
  with recursive arvore as (
    select f.id, f.texto_md, f.tipo, f.tarefa_estado, 1 as nivel, array[f.ordem] as caminho
    from public.doc_linhas f
    where f.pai_id = p_linha and f.deleted_at is null
    union all
    select f.id, f.texto_md, f.tipo, f.tarefa_estado, a.nivel + 1, a.caminho || f.ordem
    from public.doc_linhas f
    join arvore a on f.pai_id = a.id
    where f.deleted_at is null
  )
  select coalesce(string_agg(
    repeat('  ', nivel - 1) ||
    case
      when tipo = 'tarefa' then '- [' || case when tarefa_estado = 'concluida' then 'x' else ' ' end || '] '
      else '- '
    end || texto_md,
    E'\n' order by caminho
  ), '')
  from arvore;
$$;

-- Conclui tarefa. Sem forçar: erro se houver descendente-tarefa aberto. Com forçar: cascata atômica.
create or replace function public.concluir_tarefa(p_linha uuid, p_forcar boolean default false)
returns void language plpgsql security invoker as $$
declare v_abertas int;
begin
  with recursive sub as (
    select id from public.doc_linhas where id = p_linha and deleted_at is null
    union all
    select f.id from public.doc_linhas f join sub s on f.pai_id = s.id where f.deleted_at is null
  )
  select count(*) into v_abertas from public.doc_linhas
  where id in (select id from sub) and id <> p_linha
    and tipo = 'tarefa' and tarefa_estado = 'aberta' and deleted_at is null;

  if v_abertas > 0 and not p_forcar then
    raise exception 'TAREFA_TEM_FILHAS_ABERTAS' using errcode = 'P0001';
  end if;

  if p_forcar then
    with recursive sub as (
      select id from public.doc_linhas where id = p_linha and deleted_at is null
      union all
      select f.id from public.doc_linhas f join sub s on f.pai_id = s.id where f.deleted_at is null
    )
    update public.doc_linhas set tarefa_estado = 'concluida', updated_at = now()
    where id in (select id from sub) and tipo = 'tarefa' and deleted_at is null;
  else
    update public.doc_linhas set tarefa_estado = 'concluida', updated_at = now() where id = p_linha;
  end if;
end;
$$;

-- Move linha validando ciclo (destino não pode ser a própria linha nem descendente dela).
create or replace function public.mover_linha(p_linha uuid, p_novo_pai uuid, p_ordem text)
returns void language plpgsql security invoker as $$
begin
  if p_novo_pai = p_linha then raise exception 'CICLO' using errcode = 'P0001'; end if;
  if exists (
    with recursive sub as (
      select id from public.doc_linhas where id = p_linha and deleted_at is null
      union all
      select f.id from public.doc_linhas f join sub s on f.pai_id = s.id where f.deleted_at is null
    )
    select 1 from sub where id = p_novo_pai
  ) then raise exception 'CICLO' using errcode = 'P0001'; end if;

  update public.doc_linhas set pai_id = p_novo_pai, ordem = p_ordem, updated_at = now()
  where id = p_linha and deleted_at is null;
end;
$$;
