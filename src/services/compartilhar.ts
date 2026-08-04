// RoadMapMind — Fase 2: ponte de leitura e gestão do compartilhamento.
// Componentes chamam esta camada, nunca o cliente Supabase direto.
// Todo acesso de convidado passa pelas RPCs SECURITY DEFINER guarded do banco
// (migration 20260802000001) — NUNCA um SELECT direto em doc_linhas de doc alheio.
// Ver spec: docs/superpowers/plans/2026-08-02-roadmapmind-fase-2-compartilhamento.md

import type { ContextoAuth } from '@/lib/auth/server';
import type {
  AcessoItem,
  CompartilhadoComigo,
  LinkDocumento,
  ModoLink,
  Papel,
  ResultadoConvite,
} from '@/types/compartilhar';
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

interface AcessoRow {
  usuario_id: string;
  email: string;
  nome: string | null;
  cor: string | null;
  papel: Papel;
}

interface ConviteRow {
  status: ResultadoConvite['status'];
}

interface LinkRow {
  modo_link: ModoLink;
  link_token: string;
}

function mensagemDoErro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'message' in erro) return String(erro.message);
  return String(erro ?? '');
}

function erroAmigavel(erro: unknown): Error {
  const mensagem = mensagemDoErro(erro);
  if (mensagem.includes('SEM_PERMISSAO')) {
    return new Error('Só o dono pode compartilhar este documento.');
  }
  if (mensagem.includes('PAPEL_INVALIDO')) return new Error('Escolha um papel válido.');
  if (mensagem.includes('EMAIL_INVALIDO')) return new Error('Informe um email válido.');
  if (mensagem.includes('MODO_LINK_INVALIDO')) return new Error('Escolha um acesso geral válido.');
  if (mensagem.includes('ACESSO_NAO_ENCONTRADO')) {
    return new Error('Este acesso não foi encontrado.');
  }
  return new Error('Não foi possível atualizar o compartilhamento. Tente novamente.');
}

async function chamarRpc<T>(
  contexto: ContextoAuth,
  nome: string,
  parametros: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await db(contexto).rpc(nome, parametros);
  if (error) throw erroAmigavel(error);
  return data as T;
}

/** Lista os acessos vivos. A RPC confirma no banco que o solicitante é o dono. */
export async function listarAcesso(
  contexto: ContextoAuth,
  documentoId: string,
): Promise<AcessoItem[]> {
  const data = await chamarRpc<AcessoRow[]>(contexto, 'listar_acessos_documento', {
    p_documento: documentoId,
  });
  return (data ?? []).map((item) => ({
    usuarioId: item.usuario_id,
    email: item.email,
    nome: item.nome ?? undefined,
    cor: item.cor ?? undefined,
    papel: item.papel,
    pendente: false,
  }));
}

/**
 * Convida uma conta TinDo existente. Sem conta, a RPC retorna `pendente`, mas
 * esta fatia não grava nem envia nada; o fluxo pendente completo chega na Fatia 3.
 */
export async function convidarPorEmail(
  contexto: ContextoAuth,
  documentoId: string,
  email: string,
  papel: Papel,
): Promise<ResultadoConvite> {
  const data = await chamarRpc<ConviteRow[]>(contexto, 'convidar_usuario_documento', {
    p_documento: documentoId,
    p_email: email.trim().toLowerCase(),
    p_papel: papel,
  });
  const resultado = data?.[0];
  if (!resultado) throw new Error('Não foi possível concluir o convite. Tente novamente.');
  return { status: resultado.status };
}

/** Troca leitor↔editor para uma pessoa já convidada. */
export async function trocarPapel(
  contexto: ContextoAuth,
  documentoId: string,
  usuarioId: string,
  papel: Papel,
): Promise<void> {
  await chamarRpc(contexto, 'trocar_papel_documento', {
    p_documento: documentoId,
    p_usuario: usuarioId,
    p_papel: papel,
  });
}

/** Revoga com soft delete dentro da RPC. */
export async function revogar(
  contexto: ContextoAuth,
  documentoId: string,
  usuarioId: string,
): Promise<void> {
  await chamarRpc(contexto, 'revogar_acesso_documento', {
    p_documento: documentoId,
    p_usuario: usuarioId,
  });
}

async function configurarLink(
  contexto: ContextoAuth,
  documentoId: string,
  modo: ModoLink | null,
  regenerar: boolean,
): Promise<LinkDocumento> {
  const data = await chamarRpc<LinkRow[]>(contexto, 'configurar_link_documento', {
    p_documento: documentoId,
    p_modo: modo,
    p_regenerar: regenerar,
  });
  const link = data?.[0];
  if (!link) throw new Error('Não foi possível carregar o link deste documento.');
  return { token: link.link_token, modo: link.modo_link };
}

/** Lê/inicializa o link pela mesma RPC guarded, sem SELECT direto na tabela. */
export function linkDoDocumento(
  contexto: ContextoAuth,
  documentoId: string,
): Promise<LinkDocumento> {
  return configurarLink(contexto, documentoId, null, false);
}

export function definirModoLink(
  contexto: ContextoAuth,
  documentoId: string,
  modo: ModoLink,
): Promise<LinkDocumento> {
  return configurarLink(contexto, documentoId, modo, false);
}

export async function regenerarToken(contexto: ContextoAuth, documentoId: string): Promise<string> {
  return (await configurarLink(contexto, documentoId, null, true)).token;
}
