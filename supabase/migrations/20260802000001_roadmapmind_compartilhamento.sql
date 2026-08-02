-- RoadMapMind — Fase 2 (Compartilhamento): fundação de LEITURA.
-- Spec: docs/superpowers/plans/2026-08-02-roadmapmind-fase-2-compartilhamento.md
-- Tickets 01 (schema) + 05 (espelho × permissão). Tudo ADITIVO — não altera a Fase 1.
--
-- Modelo de segurança: a RLS de doc_linhas/doc_espelhos CONTINUA dono-only
-- (usuario_id = auth.uid()). NENHUMA policy permissiva para convidado. Todo
-- acesso de convidado passa por RPCs SECURITY DEFINER com guard doc_papel_efetivo,
-- que sobe SÓ o caminho real (pai_id). Espelho expande LEITURA (mostra conteúdo),
-- nunca escrita — e é TERMINAL (não desce nos filhos), igual documento_como_markdown v2.
--
-- Esta migration entrega só a LEITURA. As RPCs de ESCRITA do convidado editor
-- (com validação de subárvore) vêm na fatia de edição do convidado, migration própria.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. doc_permissoes — quem tem acesso a qual documento (unidade = documento-raiz)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.doc_permissoes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.doc_linhas(id),  -- linha-raiz do doc (título + subárvore)
  usuario_id uuid not null references auth.users(id),           -- quem RECEBE o acesso
  papel varchar(20) not null check (papel in ('leitor','editor')),
  criado_por uuid not null references auth.users(id),           -- dono que compartilhou
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);
create unique index doc_permissoes_unica on public.doc_permissoes (documento_id, usuario_id)
  where deleted_at is null;
create index doc_permissoes_por_usuario on public.doc_permissoes (usuario_id) where deleted_at is null;
create index doc_permissoes_por_doc on public.doc_permissoes (documento_id) where deleted_at is null;

create trigger set_updated_at before update on public.doc_permissoes
  for each row execute function public.set_updated_at();

alter table public.doc_permissoes enable row level security;
-- o dono do doc gerencia as permissões; o convidado enxerga a própria linha (p/ "compartilhados comigo"):
create policy doc_permissoes_dono on public.doc_permissoes for all
  using (criado_por = auth.uid()) with check (criado_por = auth.uid());
create policy doc_permissoes_eu on public.doc_permissoes for select
  using (usuario_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. doc_compartilhamento — modo do link + token por documento
-- ─────────────────────────────────────────────────────────────────────────────
create table public.doc_compartilhamento (
  documento_id uuid primary key references public.doc_linhas(id),  -- 1 linha por doc com link ligado
  usuario_id uuid not null references auth.users(id),              -- dono (denormalizado p/ RLS barata)
  modo_link varchar(20) not null default 'restrito'
    check (modo_link in ('restrito','publico_leitura')),
  link_token uuid not null default gen_random_uuid(),  -- identifica o doc no link SEM expor o id real
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);
create unique index doc_compartilhamento_token on public.doc_compartilhamento (link_token)
  where deleted_at is null;

create trigger set_updated_at before update on public.doc_compartilhamento
  for each row execute function public.set_updated_at();

alter table public.doc_compartilhamento enable row level security;
create policy doc_compartilhamento_dono on public.doc_compartilhamento for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. doc_convites — convite pendente por email (vira permissão ao cadastrar)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.doc_convites (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.doc_linhas(id),
  email text not null,                                  -- sempre lower(trim(email)) na app
  papel varchar(20) not null check (papel in ('leitor','editor')),
  token uuid not null default gen_random_uuid(),
  status varchar(20) not null default 'pendente'
    check (status in ('pendente','aceito','revogado')),
  convidado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);
create unique index doc_convites_pendente_unico on public.doc_convites (documento_id, email)
  where deleted_at is null and status = 'pendente';
create index doc_convites_por_email on public.doc_convites (email) where status = 'pendente';

create trigger set_updated_at before update on public.doc_convites
  for each row execute function public.set_updated_at();

alter table public.doc_convites enable row level security;
create policy doc_convites_dono on public.doc_convites for all
  using (convidado_por = auth.uid()) with check (convidado_por = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. doc_papel_efetivo() — o guard central. Sobe o caminho REAL (pai_id).
--    Espelho NÃO entra aqui (não expande acesso de escrita).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.doc_papel_efetivo(p_linha uuid, p_uid uuid)
returns varchar language sql security definer stable set search_path = public as $$
  with recursive ancestrais as (
    select id, pai_id, usuario_id from doc_linhas where id = p_linha and deleted_at is null
    union all
    select l.id, l.pai_id, l.usuario_id
    from doc_linhas l join ancestrais a on l.id = a.pai_id
    where l.deleted_at is null
  )
  select case
    when exists (select 1 from ancestrais where usuario_id = p_uid) then 'dono'
    when exists (select 1 from doc_permissoes p join ancestrais a on a.id = p.documento_id
                 where p.usuario_id = p_uid and p.deleted_at is null and p.papel = 'editor') then 'editor'
    when exists (select 1 from doc_permissoes p join ancestrais a on a.id = p.documento_id
                 where p.usuario_id = p_uid and p.deleted_at is null and p.papel = 'leitor') then 'leitor'
    else null
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPCs de LEITURA (guarded). Espelho: mostra o conteúdo (ticket 05) e é
--    TERMINAL — via_espelho=true não desce nos filhos (igual markdown v2).
--    O `union` (distinct) + o gate `not via_espelho` cortam qualquer loop.
-- ─────────────────────────────────────────────────────────────────────────────

-- "Compartilhados comigo": docs-raiz onde tenho permissão viva.
create or replace function public.listar_compartilhados_comigo()
returns table (documento_id uuid, titulo_md text, papel varchar, dono uuid)
language sql security definer stable set search_path = public as $$
  select l.id, l.texto_md, p.papel, l.usuario_id
  from doc_permissoes p join doc_linhas l on l.id = p.documento_id
  where p.usuario_id = auth.uid() and p.deleted_at is null and l.deleted_at is null;
$$;

-- Leitura logada: subárvore (pai_id) + linhas espelhadas (terminais), só se auth.uid() tem papel.
create or replace function public.documento_compartilhado(p_documento uuid)
returns setof public.doc_linhas
language sql security definer stable set search_path = public as $$
  with recursive alcance as (
    select l.id, false as via_espelho
    from doc_linhas l
    where l.id = p_documento and l.deleted_at is null
      and public.doc_papel_efetivo(p_documento, auth.uid()) is not null
    union
    select x.id, x.via_espelho
    from alcance a
    cross join lateral (
      select f.id, false as via_espelho from doc_linhas f
        where f.pai_id = a.id and f.deleted_at is null and not a.via_espelho
      union all
      select e.linha_id, true as via_espelho from doc_espelhos e
        join doc_linhas el on el.id = e.linha_id and el.deleted_at is null
       where e.mae_id = a.id and e.deleted_at is null and not a.via_espelho
    ) x
  )
  select l.* from doc_linhas l
  join (select distinct id from alcance) a on a.id = l.id;
$$;

-- Espelhos a materializar no doc compartilhado (mae_id nas linhas REAIS alcançadas).
create or replace function public.espelhos_do_documento_compartilhado(p_documento uuid)
returns setof public.doc_espelhos
language sql security definer stable set search_path = public as $$
  with recursive alcance as (
    select l.id, false as via_espelho
    from doc_linhas l
    where l.id = p_documento and l.deleted_at is null
      and public.doc_papel_efetivo(p_documento, auth.uid()) is not null
    union
    select x.id, x.via_espelho
    from alcance a
    cross join lateral (
      select f.id, false as via_espelho from doc_linhas f
        where f.pai_id = a.id and f.deleted_at is null and not a.via_espelho
      union all
      select e.linha_id, true as via_espelho from doc_espelhos e
        join doc_linhas el on el.id = e.linha_id and el.deleted_at is null
       where e.mae_id = a.id and e.deleted_at is null and not a.via_espelho
    ) x
  )
  select es.* from doc_espelhos es
  join (select distinct id from alcance where not via_espelho) a on a.id = es.mae_id
  where es.deleted_at is null;
$$;

-- Leitura PÚBLICA anônima por token (só se publico_leitura). anon nunca toca doc_linhas direto.
create or replace function public.documento_publico_por_token(p_token uuid)
returns setof public.doc_linhas
language sql security definer stable set search_path = public as $$
  with recursive raiz as (
    select documento_id as id from doc_compartilhamento
    where link_token = p_token and modo_link = 'publico_leitura' and deleted_at is null
  ), alcance as (
    select r.id, false as via_espelho
    from raiz r join doc_linhas l on l.id = r.id and l.deleted_at is null
    union
    select x.id, x.via_espelho
    from alcance a
    cross join lateral (
      select f.id, false as via_espelho from doc_linhas f
        where f.pai_id = a.id and f.deleted_at is null and not a.via_espelho
      union all
      select e.linha_id, true as via_espelho from doc_espelhos e
        join doc_linhas el on el.id = e.linha_id and el.deleted_at is null
       where e.mae_id = a.id and e.deleted_at is null and not a.via_espelho
    ) x
  )
  select l.* from doc_linhas l
  join (select distinct id from alcance) a on a.id = l.id;
$$;
grant execute on function public.documento_publico_por_token(uuid) to anon;

-- Espelhos do doc público por token (para o render anônimo materializar).
create or replace function public.espelhos_publicos_por_token(p_token uuid)
returns setof public.doc_espelhos
language sql security definer stable set search_path = public as $$
  with recursive raiz as (
    select documento_id as id from doc_compartilhamento
    where link_token = p_token and modo_link = 'publico_leitura' and deleted_at is null
  ), alcance as (
    select r.id, false as via_espelho
    from raiz r join doc_linhas l on l.id = r.id and l.deleted_at is null
    union
    select x.id, x.via_espelho
    from alcance a
    cross join lateral (
      select f.id, false as via_espelho from doc_linhas f
        where f.pai_id = a.id and f.deleted_at is null and not a.via_espelho
      union all
      select e.linha_id, true as via_espelho from doc_espelhos e
        join doc_linhas el on el.id = e.linha_id and el.deleted_at is null
       where e.mae_id = a.id and e.deleted_at is null and not a.via_espelho
    ) x
  )
  select es.* from doc_espelhos es
  join (select distinct id from alcance where not via_espelho) a on a.id = es.mae_id
  where es.deleted_at is null;
$$;
grant execute on function public.espelhos_publicos_por_token(uuid) to anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Trigger de reconciliação de convite: ao criar conta com o email convidado,
--    o convite pendente vira doc_permissoes. À PROVA DE EXCEÇÃO — nunca derruba
--    o cadastro (caveat research 02); a app reconcilia no 1º login como rede de segurança.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reconciliar_convites_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into doc_permissoes (documento_id, usuario_id, papel, criado_por)
    select c.documento_id, new.id, c.papel, c.convidado_por
    from doc_convites c
    where c.status = 'pendente' and c.deleted_at is null and lower(c.email) = lower(new.email)
    on conflict (documento_id, usuario_id) where deleted_at is null do nothing;

    update doc_convites set status = 'aceito', updated_at = now()
    where status = 'pendente' and deleted_at is null and lower(email) = lower(new.email);
  exception when others then
    null;  -- NUNCA bloquear o cadastro; rede de segurança reconcilia no 1º login
  end;
  return new;
end;
$$;
create trigger reconciliar_convites after insert on auth.users
  for each row execute function public.reconciliar_convites_novo_usuario();
