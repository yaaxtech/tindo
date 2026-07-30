-- RoadMapMind — espelhos (Fatia 7): a MESMA linha aparecendo sob várias mães.
-- O conteúdo nunca duplica: doc_espelhos só aponta (linha_id) e posiciona
-- (mae_id + ordem). Estende mover_linha (ciclo também via espelhos) e
-- documento_como_markdown (espelho aparece marcado com ↻ e NÃO desce nos
-- filhos — corta recursão).
-- Spec: docs/superpowers/plans/2026-07-30-roadmapmind-fase-1-mvp.md (ticket 09)

create table public.doc_espelhos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  linha_id uuid not null references public.doc_linhas(id),   -- a linha original
  mae_id uuid not null references public.doc_linhas(id),     -- onde o espelho aparece
  ordem text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  unique (linha_id, mae_id)
);
create index doc_espelhos_mae on public.doc_espelhos (mae_id, ordem) where deleted_at is null;
create index doc_espelhos_linha on public.doc_espelhos (linha_id);
create index doc_espelhos_usuario on public.doc_espelhos (usuario_id);

alter table public.doc_espelhos enable row level security;
create policy doc_espelhos_owner on public.doc_espelhos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- mover_linha v2: o ciclo agora considera as DUAS arestas — pai_id (real) e
-- espelho (mae_id → linha_id). Mover L para baixo de P é proibido se P for
-- alcançável a partir de L por qualquer combinação delas.
create or replace function public.mover_linha(p_linha uuid, p_novo_pai uuid, p_ordem text)
returns void language plpgsql security invoker as $$
begin
  if p_novo_pai = p_linha then raise exception 'CICLO' using errcode = 'P0001'; end if;
  if exists (
    with recursive arestas as (
      select pai_id as de, id as para from public.doc_linhas
      where deleted_at is null and pai_id is not null
      union all
      select mae_id as de, linha_id as para from public.doc_espelhos
      where deleted_at is null
    ), sub as (
      select p_linha as id
      union
      select a.para from arestas a join sub s on a.de = s.id
    )
    select 1 from sub where id = p_novo_pai
  ) then raise exception 'CICLO' using errcode = 'P0001'; end if;

  update public.doc_linhas set pai_id = p_novo_pai, ordem = p_ordem, updated_at = now()
  where id = p_linha and deleted_at is null;
end;
$$;

-- documento_como_markdown v2: filhos de um nó = linhas reais (pai_id) +
-- espelhos (mae_id), intercalados pela ordem. Espelho sai com '↻ ' e a
-- recursão para nele (um espelho nunca expande os filhos — sem loop).
create or replace function public.documento_como_markdown(p_linha uuid)
returns text language sql security invoker stable as $$
  with recursive arestas as (
    select f.id, f.texto_md, f.tipo, f.tarefa_estado, f.ordem, f.pai_id as de, false as espelho
    from public.doc_linhas f
    where f.deleted_at is null and f.pai_id is not null
    union all
    select l.id, l.texto_md, l.tipo, l.tarefa_estado, e.ordem, e.mae_id as de, true as espelho
    from public.doc_espelhos e
    join public.doc_linhas l on l.id = e.linha_id
    where e.deleted_at is null and l.deleted_at is null
  ), arvore as (
    select x.id, x.texto_md, x.tipo, x.tarefa_estado, x.espelho,
           1 as nivel, array[x.ordem] as caminho
    from arestas x
    where x.de = p_linha
    union all
    select x.id, x.texto_md, x.tipo, x.tarefa_estado, x.espelho,
           a.nivel + 1, a.caminho || x.ordem
    from arestas x
    join arvore a on x.de = a.id
    where not a.espelho
  )
  select coalesce(string_agg(
    repeat('  ', nivel - 1) ||
    case
      when tipo = 'tarefa' then '- [' || case when tarefa_estado = 'concluida' then 'x' else ' ' end || '] '
      else '- '
    end || case when espelho then '↻ ' else '' end || texto_md,
    E'\n' order by caminho
  ), '')
  from arvore;
$$;
