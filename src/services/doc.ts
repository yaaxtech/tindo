// RoadMapMind — ÚNICA ponte de dados da árvore de nós (outline + mindmap).
// Componentes chamam esta camada, nunca o cliente Supabase direto.
// MVP: acesso via service role (getAdminClient) + guard manual de usuario_id
// (mesmo padrão das API routes do TinDo). RLS no schema fica pronta pro login real.
// Ver spec: docs/superpowers/plans/2026-07-30-roadmapmind-fase-1-mvp.md

import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import type { DocLinha } from '@/types/doc';
import type { SupabaseClient } from '@supabase/supabase-js';
import { derivarTextoMd } from './doc-markdown';

// `doc_linhas` ainda não está em database.ts (não dá pra rodar `gen types` na
// conta do TinDo). Usamos um client destipado nesta camada; a tipagem forte
// vive na fronteira (DocLinha + doc-markdown).
function db(): SupabaseClient {
  return getAdminClient() as unknown as SupabaseClient;
}

interface LinhaRow {
  id: string;
  pai_id: string | null;
  ordem: string;
  conteudo: unknown;
  texto_md: string | null;
  tipo: DocLinha['tipo'];
  tarefa_estado: DocLinha['tarefaEstado'];
  modo_lista: DocLinha['modoLista'];
}

function rowParaLinha(r: LinhaRow): DocLinha {
  return {
    id: r.id,
    paiId: r.pai_id,
    ordem: r.ordem,
    conteudo: Array.isArray(r.conteudo) ? r.conteudo : [],
    textoMd: r.texto_md ?? '',
    tipo: r.tipo,
    tarefaEstado: r.tarefa_estado,
    modoLista: r.modo_lista,
  };
}

async function nomeDoUsuario(usuarioId: string): Promise<string> {
  const { data } = await getAdminClient().auth.admin.getUserById(usuarioId);
  const u = data?.user;
  const meta = (u?.user_metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.name === 'string' && meta.name.trim()) return meta.name.trim();
  if (typeof meta.full_name === 'string' && meta.full_name.trim()) return meta.full_name.trim();
  if (u?.email) return u.email.split('@')[0] ?? 'Meu documento';
  return 'Meu documento';
}

async function checarPosse(usuarioId: string, linhaId: string): Promise<void> {
  const { data, error } = await db()
    .from('doc_linhas')
    .select('id')
    .eq('id', linhaId)
    .eq('usuario_id', usuarioId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Linha não encontrada ou sem permissão.');
}

/** Cria a raiz do usuário (pai_id NULL, texto = nome do usuário) se não existir. */
export async function garantirRaiz(): Promise<DocLinha> {
  const usuarioId = await getUsuarioIdMVP();
  const { data: existente, error: e1 } = await db()
    .from('doc_linhas')
    .select('*')
    .eq('usuario_id', usuarioId)
    .is('pai_id', null)
    .is('deleted_at', null)
    .maybeSingle();
  if (e1) throw e1;
  if (existente) return rowParaLinha(existente as LinhaRow);

  const nome = await nomeDoUsuario(usuarioId);
  const conteudo = [{ type: 'text', text: nome, styles: {} }];
  const nova = {
    id: crypto.randomUUID(),
    usuario_id: usuarioId,
    pai_id: null,
    ordem: 'a0',
    conteudo,
    texto_md: nome,
    tipo: 'texto' as const,
    tarefa_estado: null,
    modo_lista: 'herdado' as const,
  };
  const { data, error } = await db().from('doc_linhas').insert(nova).select('*').single();
  if (error) throw error;
  return rowParaLinha(data as LinhaRow);
}

/** Carrega todas as linhas vivas do usuário (a árvore inteira). */
export async function carregarDocumento(): Promise<DocLinha[]> {
  const usuarioId = await getUsuarioIdMVP();
  const { data, error } = await db()
    .from('doc_linhas')
    .select('*')
    .eq('usuario_id', usuarioId)
    .is('deleted_at', null);
  if (error) throw error;
  return ((data ?? []) as LinhaRow[]).map(rowParaLinha);
}

/**
 * Sincroniza o documento: upsert idempotente das linhas atuais (deriva
 * texto_md no write, RN-03) e soft-delete das que sumiram. A raiz (`raizId`)
 * é sempre preservada. Idempotente: salvar o mesmo estado 2× não muda nada.
 */
export async function salvarDocumento(linhas: DocLinha[], raizId: string): Promise<void> {
  const usuarioId = await getUsuarioIdMVP();
  const agora = new Date().toISOString();

  if (linhas.length > 0) {
    const rows = linhas.map((l) => ({
      id: l.id,
      usuario_id: usuarioId,
      pai_id: l.paiId,
      ordem: l.ordem,
      conteudo: l.conteudo,
      texto_md: derivarTextoMd(l.conteudo),
      tipo: l.tipo,
      tarefa_estado: l.tarefaEstado,
      modo_lista: l.modoLista,
      deleted_at: null,
      updated_at: agora,
    }));
    const { error } = await db().from('doc_linhas').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  const preservar = [raizId, ...linhas.map((l) => l.id)];
  const { error: eDel } = await db()
    .from('doc_linhas')
    .update({ deleted_at: agora })
    .eq('usuario_id', usuarioId)
    .is('deleted_at', null)
    .not('id', 'in', `(${preservar.join(',')})`);
  if (eDel) throw eDel;
}

/** Soft-delete de linhas específicas (não desce na subárvore — use salvarDocumento pro sync). */
export async function removerLinhas(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const usuarioId = await getUsuarioIdMVP();
  const { error } = await db()
    .from('doc_linhas')
    .update({ deleted_at: new Date().toISOString() })
    .eq('usuario_id', usuarioId)
    .in('id', ids);
  if (error) throw error;
}

/** RPC concluir_tarefa (com guard de posse). Sem forçar: erro se houver filha-tarefa aberta. */
export async function concluirTarefa(linhaId: string, forcar = false): Promise<void> {
  const usuarioId = await getUsuarioIdMVP();
  await checarPosse(usuarioId, linhaId);
  const { error } = await db().rpc('concluir_tarefa', { p_linha: linhaId, p_forcar: forcar });
  if (error) throw error;
}

/** RPC mover_linha (com guard de posse). Valida ciclo no banco. */
export async function moverLinha(linhaId: string, novoPaiId: string, ordem: string): Promise<void> {
  const usuarioId = await getUsuarioIdMVP();
  await checarPosse(usuarioId, linhaId);
  await checarPosse(usuarioId, novoPaiId);
  const { error } = await db().rpc('mover_linha', {
    p_linha: linhaId,
    p_novo_pai: novoPaiId,
    p_ordem: ordem,
  });
  if (error) throw error;
}

/** RPC documento_como_markdown (com guard de posse). */
export async function exportarMarkdown(linhaId: string): Promise<string> {
  const usuarioId = await getUsuarioIdMVP();
  await checarPosse(usuarioId, linhaId);
  const { data, error } = await db().rpc('documento_como_markdown', { p_linha: linhaId });
  if (error) throw error;
  return (data as string) ?? '';
}
