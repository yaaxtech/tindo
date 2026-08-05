// RoadMapMind — Fase 2: ponte de leitura e gestão do compartilhamento.
// Componentes chamam esta camada, nunca o cliente Supabase direto.
// Todo acesso de convidado passa pelas RPCs SECURITY DEFINER guarded do banco
// (migration 20260802000001) — NUNCA um SELECT direto em doc_linhas de doc alheio.
// Ver spec: docs/superpowers/plans/2026-08-02-roadmapmind-fase-2-compartilhamento.md

import { ORIGEM_OFICIAL } from '@/lib/app-url';
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
import { enviarEmailConvite } from './email';
import { obterPerfil } from './perfil';

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

/** Título amigável do doc para o email de convite (fallback quando vazio). */
async function tituloDoDocumento(contexto: ContextoAuth, documentoId: string): Promise<string> {
  const { data, error } = await db(contexto)
    .from('doc_linhas')
    .select('texto_md')
    .eq('id', documentoId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw erroAmigavel(error);
  const texto = (data as { texto_md: string | null } | null)?.texto_md;
  return texto?.trim() || 'Documento sem título';
}

function urlDoDocumento(documentoId: string): string {
  return `${ORIGEM_OFICIAL}/docs?doc=${documentoId}`;
}

function urlDeCadastro(): string {
  return `${ORIGEM_OFICIAL}/cadastro`;
}

/**
 * Grava/atualiza o convite pendente em `doc_convites` (email sem conta).
 * Respeita o índice único parcial (documento_id, email) where status='pendente':
 * se já existe um pendente para o par, atualiza o papel (reenvia, não duplica).
 */
async function gravarConvitePendente(
  contexto: ContextoAuth,
  documentoId: string,
  email: string,
  papel: Papel,
): Promise<void> {
  const cliente = db(contexto);
  const { data: existente, error: erroSelect } = await cliente
    .from('doc_convites')
    .select('id')
    .eq('documento_id', documentoId)
    .eq('email', email)
    .eq('status', 'pendente')
    .is('deleted_at', null)
    .maybeSingle();
  if (erroSelect) throw erroAmigavel(erroSelect);

  const linhaExistente = existente as { id: string } | null;
  if (linhaExistente) {
    const { error } = await cliente
      .from('doc_convites')
      .update({ papel, updated_at: new Date().toISOString() })
      .eq('id', linhaExistente.id);
    if (error) throw erroAmigavel(error);
    return;
  }

  const { error } = await cliente.from('doc_convites').insert({
    documento_id: documentoId,
    email,
    papel,
    convidado_por: contexto.usuarioId,
  });
  if (error) throw erroAmigavel(error);
}

/**
 * Convida por email: conta existente (`concedido`/`ja_tem`) grava
 * `doc_permissoes` (via RPC) e envia email com o link do documento;
 * sem conta (`pendente`) grava um convite pendente em `doc_convites` e
 * envia email com o link de cadastro; auto-convite (`auto`) não envia nada.
 */
export async function convidarPorEmail(
  contexto: ContextoAuth,
  documentoId: string,
  email: string,
  papel: Papel,
): Promise<ResultadoConvite> {
  const emailNormalizado = email.trim().toLowerCase();
  const data = await chamarRpc<ConviteRow[]>(contexto, 'convidar_usuario_documento', {
    p_documento: documentoId,
    p_email: emailNormalizado,
    p_papel: papel,
  });
  const resultado = data?.[0];
  if (!resultado) throw new Error('Não foi possível concluir o convite. Tente novamente.');
  const { status } = resultado;

  if (status === 'auto') return { status };

  const [perfil, titulo] = await Promise.all([
    obterPerfil(contexto),
    tituloDoDocumento(contexto, documentoId),
  ]);

  if (status === 'pendente') {
    await gravarConvitePendente(contexto, documentoId, emailNormalizado, papel);
    await enviarEmailConvite({
      para: emailNormalizado,
      nomeDono: perfil.nome,
      tituloDoc: titulo,
      url: urlDeCadastro(),
      temConta: false,
    });
    return { status };
  }

  // 'concedido' | 'ja_tem' — conta já existe, o acesso já foi gravado pela RPC.
  await enviarEmailConvite({
    para: emailNormalizado,
    nomeDono: perfil.nome,
    tituloDoc: titulo,
    url: urlDoDocumento(documentoId),
    temConta: true,
  });
  return { status };
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

/**
 * Rede de segurança de reconciliação no 1º login (espelha o trigger
 * `reconciliar_convites_novo_usuario` da Fatia 0): materializa `doc_permissoes`
 * para qualquer `doc_convites` pendente do email autenticado e marca o
 * convite como `aceito`. Idempotente (índice único de `doc_permissoes`).
 *
 * A identidade vem de `auth.uid()` DENTRO da RPC (SECURITY DEFINER) — nunca de
 * parâmetro. Passar email/usuário como argumento abriria um vazamento: um
 * logado poderia materializar os convites de outra pessoa. Por isso a RPC não
 * recebe nada; deriva o usuário e o email dele no banco.
 *
 * Best-effort e NUNCA lança — chamada em todo carregamento de "Compartilhados
 * comigo"; se a RPC falhar (ou ainda não existir em produção), o carregamento
 * do usuário não pode quebrar por causa dela.
 */
export async function reconciliarConvitesPendentes(contexto: ContextoAuth): Promise<void> {
  try {
    await db(contexto).rpc('reconciliar_convites_pendentes');
    // Erro é ignorado de propósito: rede de segurança best-effort (ver docstring).
  } catch {
    // Idem: nunca deixa a app quebrar por causa desta reconciliação.
  }
}
