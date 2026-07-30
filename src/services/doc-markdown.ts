// RoadMapMind — mapeamento entre a árvore de blocos do BlockNote e as linhas
// planas de `doc_linhas`. Puro (sem I/O): fácil de testar.
// Ver spec: docs/superpowers/plans/2026-07-30-roadmapmind-fase-1-mvp.md

import type { DocLinha, ModoLista, TarefaEstado, TipoLinha } from '@/types/doc';
import { generateNKeysBetween } from 'fractional-indexing';

/** Forma mínima de um bloco BlockNote que usamos (árvore aninhada). */
export interface BlocoBN {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: BlocoBN[];
}

/** Espelho: a MESMA linha aparecendo sob outra mãe (linha em `doc_espelhos`). */
export interface DocEspelho {
  id: string; // vira o id do BLOCO-espelho no editor
  linhaId: string; // linha original (dona do conteúdo)
  maeId: string;
  ordem: string;
}

function asArray(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

function derivarTipo(type: string): TipoLinha {
  if (type === 'checkListItem') return 'tarefa';
  if (type === 'codeBlock') return 'codigo';
  return 'texto';
}

function derivarModoLista(type: string): ModoLista {
  if (type === 'bulletListItem') return 'marcadores';
  if (type === 'numberedListItem') return 'numeros';
  return 'herdado';
}

function derivarTarefaEstado(type: string, props?: Record<string, unknown>): TarefaEstado | null {
  if (type !== 'checkListItem') return null;
  return props?.checked === true ? 'concluida' : 'aberta';
}

function tipoParaBlockNoteType(tipo: TipoLinha, modo: ModoLista): string {
  if (tipo === 'tarefa') return 'checkListItem';
  if (tipo === 'codigo') return 'codeBlock';
  if (modo === 'numeros') return 'numberedListItem';
  if (modo === 'marcadores') return 'bulletListItem';
  return 'paragraph';
}

/** Texto plano da linha (para IA/busca/export). Sem prefixo — o `- [ ]` é do SQL. */
export function derivarTextoMd(conteudo: unknown[]): string {
  let out = '';
  for (const item of asArray(conteudo)) {
    if (
      item &&
      typeof item === 'object' &&
      'text' in item &&
      typeof (item as { text: unknown }).text === 'string'
    ) {
      out += (item as { text: string }).text;
    }
  }
  return out;
}

/**
 * Achata a árvore de blocos (filhos de `paiId`) em linhas planas com pai_id +
 * ordem fracional. Linhas de conteúdo vazio E sem filhos são descartadas
 * (linhas em branco não persistem).
 */
export function blocosParaLinhas(
  blocos: BlocoBN[],
  paiId: string | null,
  espelhoIds?: Set<string>,
): DocLinha[] {
  const out: DocLinha[] = [];
  const walk = (nivel: BlocoBN[], pai: string | null): void => {
    const relevantes = nivel.filter(
      (b) =>
        !espelhoIds?.has(b.id) &&
        (derivarTextoMd(asArray(b.content)).trim() !== '' || (b.children?.length ?? 0) > 0),
    );
    const ordens = generateNKeysBetween(null, null, relevantes.length);
    relevantes.forEach((b, i) => {
      const conteudo = asArray(b.content);
      out.push({
        id: b.id,
        paiId: pai,
        ordem: ordens[i] as string,
        conteudo,
        textoMd: derivarTextoMd(conteudo),
        tipo: derivarTipo(b.type),
        tarefaEstado: derivarTarefaEstado(b.type, b.props),
        modoLista: derivarModoLista(b.type),
      });
      if (b.children?.length) walk(b.children, b.id);
    });
  };
  walk(blocos, paiId);
  return out;
}

/**
 * Reconstrói a árvore de blocos (PartialBlock) a partir das linhas planas,
 * pegando os filhos diretos de `raizId` recursivamente, ordenados por `ordem`.
 */
export function linhasParaBlocos(
  linhas: DocLinha[],
  raizId: string | null,
  espelhos: DocEspelho[] = [],
): BlocoBN[] {
  const porPai = new Map<string | null, DocLinha[]>();
  const porId = new Map<string, DocLinha>();
  for (const l of linhas) {
    const arr = porPai.get(l.paiId) ?? [];
    arr.push(l);
    porPai.set(l.paiId, arr);
    porId.set(l.id, l);
  }
  const espelhosPorMae = new Map<string, DocEspelho[]>();
  for (const e of espelhos) {
    const arr = espelhosPorMae.get(e.maeId) ?? [];
    arr.push(e);
    espelhosPorMae.set(e.maeId, arr);
  }

  const blocoDe = (l: DocLinha, id: string): BlocoBN => ({
    id,
    type: tipoParaBlockNoteType(l.tipo, l.modoLista),
    props: l.tipo === 'tarefa' ? { checked: l.tarefaEstado === 'concluida' } : {},
    content: l.conteudo,
  });

  const montar = (pai: string | null): BlocoBN[] => {
    // filhos reais + espelhos, intercalados pela ordem fracional
    const proprios = (porPai.get(pai) ?? []).map((l) => ({ ordem: l.ordem, linha: l, esp: null }));
    const reflexos = (pai ? (espelhosPorMae.get(pai) ?? []) : [])
      .map((e) => ({ ordem: e.ordem, linha: porId.get(e.linhaId), esp: e }))
      .filter((x): x is { ordem: string; linha: DocLinha; esp: DocEspelho } => !!x.linha);
    const filhos = [...proprios, ...reflexos].sort((a, b) =>
      a.ordem < b.ordem ? -1 : a.ordem > b.ordem ? 1 : 0,
    );
    return filhos.map(({ linha, esp }) => {
      if (esp) return blocoDe(linha as DocLinha, esp.id); // espelho: sem filhos
      const l = linha as DocLinha;
      const bloco = blocoDe(l, l.id);
      const kids = montar(l.id);
      if (kids.length) bloco.children = kids;
      return bloco;
    });
  };
  return montar(raizId);
}
