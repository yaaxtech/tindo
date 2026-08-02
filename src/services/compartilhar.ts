// RoadMapMind — Fase 2: ponte de dados do compartilhamento (LEITURA).
// Componentes chamam esta camada, nunca o cliente Supabase direto.
// Todo acesso de convidado passa pelas RPCs SECURITY DEFINER guarded do banco
// (migration 20260802000001) — NUNCA um SELECT direto em doc_linhas de doc alheio.
// Ver spec: docs/superpowers/plans/2026-08-02-roadmapmind-fase-2-compartilhamento.md

import type { ContextoAuth } from '@/lib/auth/server';
import type { CompartilhadoComigo } from '@/types/compartilhar';
import type { DocLinha } from '@/types/doc';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocEspelho } from './doc-markdown';

// doc_linhas não está em database.ts (padrão da Fase 1: client destipado nesta
// camada; a tipagem forte vive no domínio — DocLinha/CompartilhadoComigo).
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

interface EspelhoRow {
  id: string;
  linha_id: string;
  mae_id: string;
  ordem: string;
}

function rowParaEspelho(r: EspelhoRow): DocEspelho {
  return { id: r.id, linhaId: r.linha_id, maeId: r.mae_id, ordem: r.ordem };
}

interface CompartilhadoRow {
  documento_id: string;
  titulo_md: string | null;
  papel: CompartilhadoComigo['papel'];
  dono: string;
}

/** Documentos de outras pessoas onde eu tenho acesso vivo ("Compartilhados comigo"). */
export async function listarCompartilhadosComigo(
  contexto: ContextoAuth,
): Promise<CompartilhadoComigo[]> {
  const { data, error } = await db(contexto).rpc('listar_compartilhados_comigo');
  if (error) throw error;
  return ((data ?? []) as CompartilhadoRow[]).map((r) => ({
    documentoId: r.documento_id,
    tituloMd: r.titulo_md ?? '',
    papel: r.papel,
    dono: r.dono,
  }));
}

/**
 * Carrega a subárvore de um documento compartilhado (leitura guarded pelo banco).
 * A RPC devolve vazio se o usuário logado não tem papel — isolamento garantido
 * no banco, não só na app. Inclui as linhas espelhadas (conteúdo visível,
 * ticket 05) e os espelhos a materializar.
 */
export async function carregarDocumentoCompartilhado(
  contexto: ContextoAuth,
  documentoId: string,
): Promise<{ linhas: DocLinha[]; espelhos: DocEspelho[] }> {
  const [linhasRes, espelhosRes] = await Promise.all([
    db(contexto).rpc('documento_compartilhado', { p_documento: documentoId }),
    db(contexto).rpc('espelhos_do_documento_compartilhado', { p_documento: documentoId }),
  ]);
  if (linhasRes.error) throw linhasRes.error;
  if (espelhosRes.error) throw espelhosRes.error;
  return {
    linhas: ((linhasRes.data ?? []) as LinhaRow[]).map(rowParaLinha),
    espelhos: ((espelhosRes.data ?? []) as EspelhoRow[]).map(rowParaEspelho),
  };
}
