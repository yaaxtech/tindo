// RoadMapMind — ÚNICA ponte de dados da árvore de nós (outline + mindmap).
// Componentes chamam esta camada, nunca o cliente Supabase direto.
// Acesso pelo cliente da sessão: a RLS do banco é a fronteira de segurança.
// Ver spec: docs/superpowers/plans/2026-07-30-roadmapmind-fase-1-mvp.md

import { ErroNaoEncontrado, ErroValidacao } from '@/lib/api/erros';
import type { ContextoAuth } from '@/lib/auth/server';
import type { DocLinha } from '@/types/doc';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type DocEspelho, derivarTextoMd } from './doc-markdown';

// `doc_linhas` ainda não está em database.ts. Usamos um client destipado nesta
// camada; a tipagem forte vive na fronteira (DocLinha + doc-markdown).
function db(contexto: ContextoAuth): SupabaseClient {
  return contexto.supabase as unknown as SupabaseClient;
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

async function nomeDoUsuario(contexto: ContextoAuth): Promise<string> {
  const { data } = await contexto.supabase.auth.getUser();
  const u = data?.user;
  const meta = (u?.user_metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.name === 'string' && meta.name.trim()) return meta.name.trim();
  if (typeof meta.full_name === 'string' && meta.full_name.trim()) return meta.full_name.trim();
  if (u?.email) return u.email.split('@')[0] ?? 'Meu documento';
  return 'Meu documento';
}

async function checarPosse(contexto: ContextoAuth, linhaId: string): Promise<void> {
  const { data, error } = await db(contexto)
    .from('doc_linhas')
    .select('id')
    .eq('id', linhaId)
    .eq('usuario_id', contexto.usuarioId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ErroNaoEncontrado('Linha não encontrada ou sem permissão.');
}

/** Cria a raiz do usuário (pai_id NULL, texto = nome do usuário) se não existir. */
export async function garantirRaiz(contexto: ContextoAuth): Promise<DocLinha> {
  const { data: existente, error: e1 } = await db(contexto)
    .from('doc_linhas')
    .select('*')
    .eq('usuario_id', contexto.usuarioId)
    .is('pai_id', null)
    .is('deleted_at', null)
    .maybeSingle();
  if (e1) throw e1;
  if (existente) return rowParaLinha(existente as LinhaRow);

  const nome = await nomeDoUsuario(contexto);
  const conteudo = [{ type: 'text', text: nome, styles: {} }];
  const nova = {
    id: crypto.randomUUID(),
    usuario_id: contexto.usuarioId,
    pai_id: null,
    ordem: 'a0',
    conteudo,
    texto_md: nome,
    tipo: 'texto' as const,
    tarefa_estado: null,
    modo_lista: 'herdado' as const,
  };
  const { data, error } = await db(contexto).from('doc_linhas').insert(nova).select('*').single();
  if (error) throw error;
  return rowParaLinha(data as LinhaRow);
}

/** Carrega todas as linhas vivas do usuário (a árvore inteira). */
export async function carregarDocumento(contexto: ContextoAuth): Promise<DocLinha[]> {
  const { data, error } = await db(contexto)
    .from('doc_linhas')
    .select('*')
    .eq('usuario_id', contexto.usuarioId)
    .is('deleted_at', null);
  if (error) throw error;
  return ((data ?? []) as LinhaRow[]).map(rowParaLinha);
}

/**
 * Sincroniza o documento: upsert idempotente das linhas atuais (deriva
 * texto_md no write, RN-03) e soft-delete das que sumiram. A raiz (`raizId`)
 * é sempre preservada. Idempotente: salvar o mesmo estado 2× não muda nada.
 */
export async function salvarDocumento(
  contexto: ContextoAuth,
  linhas: DocLinha[],
  raizId: string,
): Promise<void> {
  const agora = new Date().toISOString();

  if (linhas.length > 0) {
    const rows = linhas.map((l) => ({
      id: l.id,
      usuario_id: contexto.usuarioId,
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
    const { error } = await db(contexto).from('doc_linhas').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  const preservar = [raizId, ...linhas.map((l) => l.id)];
  const { error: eDel } = await db(contexto)
    .from('doc_linhas')
    .update({ deleted_at: agora })
    .eq('usuario_id', contexto.usuarioId)
    .is('deleted_at', null)
    .not('id', 'in', `(${preservar.join(',')})`);
  if (eDel) throw eDel;
}

/** Soft-delete de linhas específicas (não desce na subárvore — use salvarDocumento pro sync). */
export async function removerLinhas(contexto: ContextoAuth, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await db(contexto)
    .from('doc_linhas')
    .update({ deleted_at: new Date().toISOString() })
    .eq('usuario_id', contexto.usuarioId)
    .in('id', ids);
  if (error) throw error;
}

/** Espelhos vivos do usuário (a UI os materializa como blocos sob a mãe). */
export async function carregarEspelhos(contexto: ContextoAuth): Promise<DocEspelho[]> {
  const { data, error } = await db(contexto)
    .from('doc_espelhos')
    .select('id, linha_id, mae_id, ordem')
    .eq('usuario_id', contexto.usuarioId)
    .is('deleted_at', null);
  if (error) throw error;
  return ((data ?? []) as { id: string; linha_id: string; mae_id: string; ordem: string }[]).map(
    (r) => ({ id: r.id, linhaId: r.linha_id, maeId: r.mae_id, ordem: r.ordem }),
  );
}

/** Cria um espelho (a linha passa a aparecer também sob `maeId`). Bloqueia ciclo. */
export async function criarEspelho(
  contexto: ContextoAuth,
  linhaId: string,
  maeId: string,
  ordem: string,
): Promise<DocEspelho> {
  await checarPosse(contexto, linhaId);
  await checarPosse(contexto, maeId);
  if (linhaId === maeId) {
    throw new ErroValidacao('Não dá para espelhar um item dentro dele mesmo.');
  }
  // ciclo: a mãe do espelho não pode estar DENTRO da subárvore da linha
  const { data: sub, error: eSub } = await db(contexto)
    .from('doc_linhas')
    .select('id, pai_id')
    .eq('usuario_id', contexto.usuarioId)
    .is('deleted_at', null);
  if (eSub) throw eSub;
  const filhosDe = new Map<string, string[]>();
  for (const r of (sub ?? []) as { id: string; pai_id: string | null }[]) {
    if (!r.pai_id) continue;
    const arr = filhosDe.get(r.pai_id) ?? [];
    arr.push(r.id);
    filhosDe.set(r.pai_id, arr);
  }
  const fila = [linhaId];
  while (fila.length) {
    const atual = fila.pop() as string;
    if (atual === maeId) {
      throw new ErroValidacao('Não dá para espelhar um item dentro dele mesmo.');
    }
    fila.push(...(filhosDe.get(atual) ?? []));
  }
  const { data, error } = await db(contexto)
    .from('doc_espelhos')
    .insert({ usuario_id: contexto.usuarioId, linha_id: linhaId, mae_id: maeId, ordem })
    .select('id, linha_id, mae_id, ordem')
    .single();
  if (error) throw error;
  const r = data as { id: string; linha_id: string; mae_id: string; ordem: string };
  return { id: r.id, linhaId: r.linha_id, maeId: r.mae_id, ordem: r.ordem };
}

/** Remove um espelho (soft delete SÓ em doc_espelhos — a linha original fica). */
export async function removerEspelho(contexto: ContextoAuth, espelhoId: string): Promise<void> {
  const { error } = await db(contexto)
    .from('doc_espelhos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', espelhoId)
    .eq('usuario_id', contexto.usuarioId);
  if (error) throw error;
}

/** RPC concluir_tarefa (com guard de posse). Sem forçar: erro se houver filha-tarefa aberta. */
export async function concluirTarefa(
  contexto: ContextoAuth,
  linhaId: string,
  forcar = false,
): Promise<void> {
  await checarPosse(contexto, linhaId);
  const { error } = await db(contexto).rpc('concluir_tarefa', {
    p_linha: linhaId,
    p_forcar: forcar,
  });
  if (error) throw error;
}

/** RPC mover_linha (com guard de posse). Valida ciclo no banco. */
export async function moverLinha(
  contexto: ContextoAuth,
  linhaId: string,
  novoPaiId: string,
  ordem: string,
): Promise<void> {
  await checarPosse(contexto, linhaId);
  await checarPosse(contexto, novoPaiId);
  const { error } = await db(contexto).rpc('mover_linha', {
    p_linha: linhaId,
    p_novo_pai: novoPaiId,
    p_ordem: ordem,
  });
  if (error) throw error;
}

/** RPC documento_como_markdown (com guard de posse). */
export async function exportarMarkdown(contexto: ContextoAuth, linhaId: string): Promise<string> {
  await checarPosse(contexto, linhaId);
  const { data, error } = await db(contexto).rpc('documento_como_markdown', {
    p_linha: linhaId,
  });
  if (error) throw error;
  return (data as string) ?? '';
}
