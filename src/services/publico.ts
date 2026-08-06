// RoadMapMind — Fase 2 / Fatia 5: leitura PÚBLICA anônima por token.
// Cliente anônimo SEM sessão (nem cookies): mesmo resultado logado ou não.
// A segurança fica no banco — as RPCs `*_publicos_por_token` são SECURITY
// DEFINER concedidas a `anon` e só devolvem doc `publico_leitura` (migration
// 20260802000001). Doc restrito/inexistente/token velho → vazio → 404 na app.

import type { DocEspelho } from '@/services/doc-markdown';
import type { DocLinha } from '@/types/doc';
import { createClient } from '@supabase/supabase-js';

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

/** Cliente anônimo puro (sem persistência de sessão) — leitura pública only. */
function clienteAnonimo() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configuração do Supabase indisponível.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface DocumentoPublico {
  raizId: string;
  titulo: string;
  linhas: DocLinha[];
  espelhos: DocEspelho[];
}

/**
 * Carrega a subárvore pública de um documento pelo token. Devolve `null` quando
 * o token não existe, o doc está `restrito` ou o link foi regenerado — a página
 * traduz isso num 404 amigável, nunca vazando o id interno do documento.
 */
export async function documentoPublicoPorToken(token: string): Promise<DocumentoPublico | null> {
  const supabase = clienteAnonimo();
  const [linhasRes, espelhosRes] = await Promise.all([
    supabase.rpc('documento_publico_por_token', { p_token: token }),
    supabase.rpc('espelhos_publicos_por_token', { p_token: token }),
  ]);
  if (linhasRes.error) throw linhasRes.error;
  if (espelhosRes.error) throw espelhosRes.error;

  const linhas = ((linhasRes.data ?? []) as LinhaRow[]).map(rowParaLinha);
  if (linhas.length === 0) return null; // restrito/inexistente/token velho

  const espelhos = ((espelhosRes.data ?? []) as EspelhoRow[]).map((r) => ({
    id: r.id,
    linhaId: r.linha_id,
    maeId: r.mae_id,
    ordem: r.ordem,
  }));

  // A raiz é a única linha cujo pai mora FORA da subárvore devolvida (a RPC sobe
  // só a partir do documento; toda outra linha tem o pai no conjunto).
  const ids = new Set(linhas.map((l) => l.id));
  const raiz = linhas.find((l) => !l.paiId || !ids.has(l.paiId)) ?? linhas[0];
  if (!raiz) return null;

  return {
    raizId: raiz.id,
    titulo: raiz.textoMd?.trim() || 'Documento compartilhado',
    linhas,
    espelhos,
  };
}
