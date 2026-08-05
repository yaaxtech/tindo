-- RoadMapMind — Fase 2 / Fatia 4: EDIÇÃO PROTEGIDA do convidado editor + aviso de espelho externo.
-- Spec: docs/superpowers/plans/2026-08-02-roadmapmind-fase-2-compartilhamento.md (Task 4)
-- Tudo ADITIVO — não altera as migrations anteriores.
--
-- Modelo de segurança (inegociável): a RLS de doc_linhas/doc_espelhos CONTINUA dono-only.
-- O convidado editor NUNCA escreve via SELECT/UPSERT direto (a RLS exigiria usuario_id = convidado).
-- Toda escrita passa por salvar_documento_compartilhado() SECURITY DEFINER, que:
--   1. exige papel 'editor' em auth.uid() (leitor/dono/null recusados);
--   2. calcula a SUBÁRVORE REAL escrevível do doc (recursão por pai_id a partir da raiz);
--   3. só grava linhas do "fecho colocável": ancoram na raiz do doc descendo SÓ por nós que
--      são eles-mesmos escrevíveis (∈ subárvore OU genuinamente-novas). Isso fecha qualquer
--      tentativa de escrever/mover/injetar linha de fora da subárvore — ex.: linha espelhada
--      cuja casa real é privada do dono, ou linha de outro documento. A linha gravada mantém
--      usuario_id = DONO do doc (o convidado não cria dado próprio).
--
-- Linhas fora do fecho (espelho-de-fora, injeção) são IGNORADAS em silêncio — o convidado não
-- perde o resto do save; só aquela edição não persiste (a linha fica só-leitura de fato).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. salvar_documento_compartilhado(p_documento, p_linhas)
--    Sincronização em massa (mesma semântica do save do dono), CONFINADA à subárvore.
--    p_linhas = jsonb array de linhas SEM a raiz (filhas do topo têm pai_id = p_documento),
--    cada uma: { id, pai_id, ordem, conteudo, tipo, tarefa_estado, modo_lista }.
--    texto_md é DERIVADO no banco a partir de conteudo (RN-03) — não confia no cliente.
--
--    Sem tabelas temporárias de propósito: cada statement recomputa as CTEs, então a função é
--    reentrante (chamá-la 2× na mesma transação não colide). Docs são pequenos; custo trivial.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.salvar_documento_compartilhado(
  p_documento uuid,
  p_linhas jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_papel varchar;
  v_dono uuid;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO' using errcode = 'P0001';
  end if;

  -- só o EDITOR escreve; leitor, não-convidado e dono (que usa o caminho próprio) recusados.
  v_papel := public.doc_papel_efetivo(p_documento, v_uid);
  if v_papel is distinct from 'editor' then
    raise exception 'SEM_PERMISSAO' using errcode = 'P0001';
  end if;

  -- dono real do doc = usuario_id da linha-raiz; toda linha gravada fica com esse dono.
  select usuario_id into v_dono
  from public.doc_linhas
  where id = p_documento and deleted_at is null;
  if v_dono is null then
    raise exception 'SEM_PERMISSAO' using errcode = 'P0001';
  end if;

  -- 1) INSERE as novas "colocáveis". FK imediata é checada ao FIM do statement, então a ordem
  --    das linhas dentro do INSERT não importa (filho pode vir antes do pai novo).
  with recursive
  sub as (
    select id from public.doc_linhas where id = p_documento and deleted_at is null
    union all
    select f.id from public.doc_linhas f join sub s on f.pai_id = s.id where f.deleted_at is null
  ),
  inp as (
    select
      (e->>'id')::uuid                     as id,
      nullif(e->>'pai_id','')::uuid        as pai_id,
      e->>'ordem'                          as ordem,
      coalesce(e->'conteudo','[]'::jsonb)  as conteudo,
      coalesce(e->>'tipo','texto')         as tipo,
      nullif(e->>'tarefa_estado','')       as tarefa_estado,
      coalesce(e->>'modo_lista','herdado') as modo_lista,
      coalesce((
        select string_agg(x->>'text','')
        from jsonb_array_elements(coalesce(e->'conteudo','[]'::jsonb)) x
        where jsonb_typeof(x->'text') = 'string'
      ), '') as texto_md,
      -- escrevível-em-si: já é da subárvore OU é genuinamente nova (não existe em lugar nenhum).
      (
        (e->>'id')::uuid in (select id from sub)
        or not exists (select 1 from public.doc_linhas d where d.id = (e->>'id')::uuid)
      ) as own
    from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) e
  ),
  placeable as (
    select i.id, i.pai_id from inp i
    where i.own and i.pai_id = p_documento
    union
    select i.id, i.pai_id from inp i
    join placeable p on i.pai_id = p.id
    where i.own
  )
  insert into public.doc_linhas
    (id, usuario_id, pai_id, ordem, conteudo, texto_md, tipo, tarefa_estado, modo_lista)
  select i.id, v_dono, i.pai_id, i.ordem, i.conteudo, i.texto_md, i.tipo, i.tarefa_estado, i.modo_lista
  from inp i
  join placeable pl on pl.id = i.id
  where not exists (select 1 from public.doc_linhas d where d.id = i.id);

  -- 2) ATUALIZA as existentes colocáveis (∈ subárvore). usuario_id fica com o dono.
  with recursive
  sub as (
    select id from public.doc_linhas where id = p_documento and deleted_at is null
    union all
    select f.id from public.doc_linhas f join sub s on f.pai_id = s.id where f.deleted_at is null
  ),
  inp as (
    select
      (e->>'id')::uuid                     as id,
      nullif(e->>'pai_id','')::uuid        as pai_id,
      e->>'ordem'                          as ordem,
      coalesce(e->'conteudo','[]'::jsonb)  as conteudo,
      coalesce(e->>'tipo','texto')         as tipo,
      nullif(e->>'tarefa_estado','')       as tarefa_estado,
      coalesce(e->>'modo_lista','herdado') as modo_lista,
      coalesce((
        select string_agg(x->>'text','')
        from jsonb_array_elements(coalesce(e->'conteudo','[]'::jsonb)) x
        where jsonb_typeof(x->'text') = 'string'
      ), '') as texto_md,
      (
        (e->>'id')::uuid in (select id from sub)
        or not exists (select 1 from public.doc_linhas d where d.id = (e->>'id')::uuid)
      ) as own
    from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) e
  ),
  placeable as (
    select i.id, i.pai_id from inp i
    where i.own and i.pai_id = p_documento
    union
    select i.id, i.pai_id from inp i
    join placeable p on i.pai_id = p.id
    where i.own
  )
  update public.doc_linhas d
  set pai_id = i.pai_id,
      ordem = i.ordem,
      conteudo = i.conteudo,
      texto_md = i.texto_md,
      tipo = i.tipo,
      tarefa_estado = i.tarefa_estado,
      modo_lista = i.modo_lista,
      updated_at = now()
  from inp i
  join placeable pl on pl.id = i.id
  where d.id = i.id
    and i.id in (select id from sub)
    and d.deleted_at is null;

  -- 3) SOFT-DELETE das linhas da subárvore (menos a raiz) que o convidado removeu
  --    (ausentes do payload). Nunca toca em nada fora da subárvore.
  with recursive
  sub as (
    select id from public.doc_linhas where id = p_documento and deleted_at is null
    union all
    select f.id from public.doc_linhas f join sub s on f.pai_id = s.id where f.deleted_at is null
  )
  update public.doc_linhas d
  set deleted_at = now(), updated_at = now()
  where d.id in (select id from sub)
    and d.id <> p_documento
    and d.deleted_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) e
      where (e->>'id')::uuid = d.id
    );
end;
$$;

revoke execute on function public.salvar_documento_compartilhado(uuid, jsonb) from public, anon;
grant execute on function public.salvar_documento_compartilhado(uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. espelhos_externos_do_documento(p_documento) → nº de espelhos na subárvore
--    cuja linha-alvo tem casa REAL fora dela. Usado pelo aviso do modal (só o dono).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.espelhos_externos_do_documento(p_documento uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  with recursive sub as (
    select l.id
    from public.doc_linhas l
    where l.id = p_documento and l.deleted_at is null
      and l.usuario_id = auth.uid()      -- só o dono enxerga a contagem; senão sub = vazio → 0
    union all
    select f.id from public.doc_linhas f join sub s on f.pai_id = s.id
    where f.deleted_at is null
  )
  select count(*)::int
  from public.doc_espelhos e
  join sub m on m.id = e.mae_id                       -- espelho posicionado DENTRO do doc
  where e.deleted_at is null
    and not exists (select 1 from sub s2 where s2.id = e.linha_id);  -- alvo mora FORA
$$;

revoke execute on function public.espelhos_externos_do_documento(uuid) from public, anon;
grant execute on function public.espelhos_externos_do_documento(uuid) to authenticated;
