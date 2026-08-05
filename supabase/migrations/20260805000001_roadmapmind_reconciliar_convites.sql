-- RoadMapMind Fase 2 / Fatia 3: rede de segurança de reconciliação de convite.
-- Espelha o trigger `reconciliar_convites_novo_usuario` (Fatia 0, já em prod),
-- mas roda sob demanda: a app chama ao carregar "Compartilhados comigo", como
-- rede de segurança caso o trigger em `auth.users` tenha falhado silenciosamente.
--
-- SEGURANÇA: a identidade vem SEMPRE de auth.uid() aqui dentro — a função NÃO
-- recebe email/usuário como parâmetro. Aceitar esses argumentos abriria um
-- vazamento: um usuário logado materializaria para si os convites de outra
-- pessoa (passando o email da vítima). Por isso deriva o email do próprio
-- auth.users pelo uid autenticado. Idempotente (índice único de doc_permissoes).

create or replace function public.reconciliar_convites_pendentes()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    return;
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null or v_email = '' then
    return;
  end if;

  insert into public.doc_permissoes (documento_id, usuario_id, papel, criado_por)
  select c.documento_id, v_uid, c.papel, c.convidado_por
  from public.doc_convites c
  where c.status = 'pendente'
    and c.deleted_at is null
    and lower(c.email) = v_email
  on conflict (documento_id, usuario_id) where deleted_at is null do nothing;

  update public.doc_convites
  set status = 'aceito', updated_at = now()
  where status = 'pendente'
    and deleted_at is null
    and lower(email) = v_email;
end;
$$;

revoke execute on function public.reconciliar_convites_pendentes() from public, anon;
grant execute on function public.reconciliar_convites_pendentes() to authenticated;
