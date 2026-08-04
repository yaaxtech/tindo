-- RoadMapMind Fase 2 / Fatia 2: gestão segura de acesso por conta existente.
-- Tudo passa por RPCs SECURITY DEFINER que confirmam que auth.uid() é o dono
-- da raiz antes de ler auth.users ou alterar permissões/link.

-- O helper de dois argumentos da Fatia 0 fica interno. A versão pública prende
-- o usuário a auth.uid(), evitando consultar o papel de terceiros.
revoke execute on function public.doc_papel_efetivo(uuid, uuid) from public, anon, authenticated;

create or replace function public.doc_meu_papel(p_linha uuid)
returns varchar
language sql
security definer
stable
set search_path = public
as $$
  select public.doc_papel_efetivo(p_linha, auth.uid());
$$;

revoke execute on function public.doc_meu_papel(uuid) from public, anon;
grant execute on function public.doc_meu_papel(uuid) to authenticated;

create or replace function public.listar_acessos_documento(p_documento uuid)
returns table (
  usuario_id uuid,
  email text,
  nome text,
  cor varchar,
  papel varchar
)
language sql
security definer
stable
set search_path = public, auth
as $$
  select
    p.usuario_id,
    u.email::text,
    coalesce(nullif(trim(perfil.nome), ''), split_part(u.email, '@', 1))::text,
    perfil.cor,
    p.papel
  from public.doc_permissoes p
  join auth.users u on u.id = p.usuario_id
  left join public.perfis_usuario perfil
    on perfil.usuario_id = p.usuario_id and perfil.deleted_at is null
  where p.documento_id = p_documento
    and p.deleted_at is null
    and exists (
      select 1
      from public.doc_linhas raiz
      where raiz.id = p_documento
        and raiz.deleted_at is null
        and raiz.usuario_id = auth.uid()
    )
  order by lower(u.email);
$$;

create or replace function public.convidar_usuario_documento(
  p_documento uuid,
  p_email text,
  p_papel varchar
)
returns table (
  status varchar,
  usuario_id uuid,
  email text,
  nome text,
  cor varchar,
  papel varchar
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(p_email));
  v_usuario auth.users%rowtype;
  v_permissao public.doc_permissoes%rowtype;
  v_nome text;
  v_cor varchar;
begin
  if p_papel is null or p_papel not in ('leitor', 'editor') then
    raise exception 'PAPEL_INVALIDO' using errcode = 'P0001';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'EMAIL_INVALIDO' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.doc_linhas raiz
    where raiz.id = p_documento
      and raiz.deleted_at is null
      and raiz.usuario_id = auth.uid()
  ) then
    raise exception 'SEM_PERMISSAO' using errcode = 'P0001';
  end if;

  select * into v_usuario
  from auth.users u
  where lower(u.email) = v_email
    and u.deleted_at is null
  limit 1;

  if not found then
    return query select
      'pendente'::varchar,
      null::uuid,
      v_email,
      null::text,
      null::varchar,
      p_papel;
    return;
  end if;

  select
    coalesce(nullif(trim(perfil.nome), ''), split_part(v_usuario.email, '@', 1)),
    perfil.cor
  into v_nome, v_cor
  from (select 1) base
  left join public.perfis_usuario perfil
    on perfil.usuario_id = v_usuario.id and perfil.deleted_at is null;

  if v_usuario.id = auth.uid() then
    return query select
      'auto'::varchar,
      v_usuario.id,
      v_usuario.email::text,
      v_nome,
      v_cor,
      'editor'::varchar;
    return;
  end if;

  -- Serializa convite/troca/revogação do mesmo par doc+usuário. O índice
  -- parcial sozinho não evita corrida entre SELECT e INSERT.
  perform pg_advisory_xact_lock(
    hashtextextended(p_documento::text || ':' || v_usuario.id::text, 0)
  );

  select * into v_permissao
  from public.doc_permissoes p
  where p.documento_id = p_documento
    and p.usuario_id = v_usuario.id
    and p.deleted_at is null
  limit 1;

  if found then
    update public.doc_permissoes
    set papel = p_papel, updated_at = now()
    where id = v_permissao.id;

    return query select
      'ja_tem'::varchar,
      v_usuario.id,
      v_usuario.email::text,
      v_nome,
      v_cor,
      p_papel;
    return;
  end if;

  select * into v_permissao
  from public.doc_permissoes p
  where p.documento_id = p_documento
    and p.usuario_id = v_usuario.id
    and p.deleted_at is not null
  order by p.updated_at desc
  limit 1;

  if found then
    update public.doc_permissoes
    set papel = p_papel,
        criado_por = auth.uid(),
        deleted_at = null,
        updated_at = now()
    where id = v_permissao.id;
  else
    insert into public.doc_permissoes (documento_id, usuario_id, papel, criado_por)
    values (p_documento, v_usuario.id, p_papel, auth.uid());
  end if;

  return query select
    'concedido'::varchar,
    v_usuario.id,
    v_usuario.email::text,
    v_nome,
    v_cor,
    p_papel;
end;
$$;

create or replace function public.trocar_papel_documento(
  p_documento uuid,
  p_usuario uuid,
  p_papel varchar
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_papel is null or p_papel not in ('leitor', 'editor') then
    raise exception 'PAPEL_INVALIDO' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.doc_linhas raiz
    where raiz.id = p_documento
      and raiz.deleted_at is null
      and raiz.usuario_id = auth.uid()
  ) then
    raise exception 'SEM_PERMISSAO' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_documento::text || ':' || p_usuario::text, 0)
  );

  update public.doc_permissoes
  set papel = p_papel, updated_at = now()
  where documento_id = p_documento
    and usuario_id = p_usuario
    and deleted_at is null;

  if not found then
    raise exception 'ACESSO_NAO_ENCONTRADO' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.revogar_acesso_documento(
  p_documento uuid,
  p_usuario uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.doc_linhas raiz
    where raiz.id = p_documento
      and raiz.deleted_at is null
      and raiz.usuario_id = auth.uid()
  ) then
    raise exception 'SEM_PERMISSAO' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_documento::text || ':' || p_usuario::text, 0)
  );

  update public.doc_permissoes
  set deleted_at = now(), updated_at = now()
  where documento_id = p_documento
    and usuario_id = p_usuario
    and deleted_at is null;

  if not found then
    raise exception 'ACESSO_NAO_ENCONTRADO' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.configurar_link_documento(
  p_documento uuid,
  p_modo varchar default null,
  p_regenerar boolean default false
)
returns table (modo_link varchar, link_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modo varchar;
  v_token uuid;
begin
  if p_modo is not null and p_modo not in ('restrito', 'publico_leitura') then
    raise exception 'MODO_LINK_INVALIDO' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.doc_linhas raiz
    where raiz.id = p_documento
      and raiz.deleted_at is null
      and raiz.usuario_id = auth.uid()
  ) then
    raise exception 'SEM_PERMISSAO' using errcode = 'P0001';
  end if;

  insert into public.doc_compartilhamento (
    documento_id,
    usuario_id,
    modo_link,
    link_token,
    deleted_at
  )
  values (
    p_documento,
    auth.uid(),
    coalesce(p_modo, 'restrito'),
    gen_random_uuid(),
    null
  )
  on conflict (documento_id) do update
  set usuario_id = auth.uid(),
      modo_link = coalesce(p_modo, doc_compartilhamento.modo_link),
      link_token = case
        when p_regenerar then gen_random_uuid()
        else doc_compartilhamento.link_token
      end,
      deleted_at = null,
      updated_at = now()
  returning doc_compartilhamento.modo_link, doc_compartilhamento.link_token
  into v_modo, v_token;

  return query select v_modo, v_token;
end;
$$;

revoke execute on function public.listar_acessos_documento(uuid) from public, anon;
revoke execute on function public.convidar_usuario_documento(uuid, text, varchar) from public, anon;
revoke execute on function public.trocar_papel_documento(uuid, uuid, varchar) from public, anon;
revoke execute on function public.revogar_acesso_documento(uuid, uuid) from public, anon;
revoke execute on function public.configurar_link_documento(uuid, varchar, boolean) from public, anon;

grant execute on function public.listar_acessos_documento(uuid) to authenticated;
grant execute on function public.convidar_usuario_documento(uuid, text, varchar) to authenticated;
grant execute on function public.trocar_papel_documento(uuid, uuid, varchar) to authenticated;
grant execute on function public.revogar_acesso_documento(uuid, uuid) to authenticated;
grant execute on function public.configurar_link_documento(uuid, varchar, boolean) to authenticated;
