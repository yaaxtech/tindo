'use client';

// RoadMapMind — menu lateral de documentos (Fatia 6). "Documento" = qualquer
// linha que TEM filhas; a árvore do menu lista só elas. Clicar foca o
// documento (editor + mapa isolam a subárvore) e atualiza a URL
// (/docs?doc=<uuid>) via <Link> real — abre em nova aba com o botão do meio.

import type { Block } from '@blocknote/core';
import { Eye, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { extrairTexto } from './Mindmap';

/** Documento de outra pessoa compartilhado comigo (Fase 2). */
export type ItemCompartilhado = {
  documentoId: string;
  tituloMd: string;
  papel: 'leitor' | 'editor';
};

type ItemMenu = {
  id: string;
  texto: string;
  profundidade: number;
  ancestrais: string[]; // pra recolher/expandir a árvore do menu
  temFilhosDoc: boolean;
};

function listarDocumentos(
  blocks: Block[],
  profundidade: number,
  ancestrais: string[],
  acc: ItemMenu[],
): ItemMenu[] {
  for (const b of blocks) {
    const filhos = (b.children ?? []).filter((c) => extrairTexto(c).trim() !== '');
    if (filhos.length > 0 && extrairTexto(b).trim() !== '') {
      const temFilhosDoc = filhos.some((f) =>
        (f.children ?? []).some((n) => extrairTexto(n).trim() !== ''),
      );
      acc.push({ id: b.id, texto: extrairTexto(b), profundidade, ancestrais, temFilhosDoc });
      listarDocumentos(filhos, profundidade + 1, [...ancestrais, b.id], acc);
    } else if (filhos.length > 0) {
      listarDocumentos(filhos, profundidade + 1, ancestrais, acc);
    }
  }
  return acc;
}

type MenuCtx = { id: string; x: number; y: number };

/** Onde a linha arrastada vai cair: dentro do alvo (filha) ou logo abaixo (irmã). */
export type ZonaDrop = 'filha' | 'irma';

/** Fatia inferior do item reservada para "soltar embaixo" (= virar irmã). */
const FAIXA_IRMA = 0.35;

/**
 * Decide a zona pela posição vertical do cursor dentro do item do menu:
 * miolo/topo = filha, faixa de baixo = irmã logo após o alvo.
 */
export function zonaDoDrop(deslocamentoY: number, altura: number): ZonaDrop {
  if (altura <= 0) return 'filha';
  return deslocamentoY >= altura * (1 - FAIXA_IRMA) ? 'irma' : 'filha';
}

export interface MenuDocumentosProps {
  doc: Block[];
  focoId: string | null;
  rotuloRaiz: string;
  aoFocar: (id: string | null) => void;
  aoRenomear: (id: string, texto: string) => void;
  aoDuplicar: (id: string) => void;
  aoExcluir: (id: string) => void;
  /** Solta em cima do alvo = filha dele; solta na faixa de baixo = irmã logo após. */
  aoMover: (id: string, alvoId: string, zona: ZonaDrop) => void;
  aoRecolher: () => void;
  /** Documentos de outras pessoas compartilhados comigo (Fase 2). */
  compartilhados?: ItemCompartilhado[];
}

export default function MenuDocumentos({
  doc,
  focoId,
  rotuloRaiz,
  aoFocar,
  aoRenomear,
  aoDuplicar,
  aoExcluir,
  aoMover,
  aoRecolher,
  compartilhados = [],
}: MenuDocumentosProps) {
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<MenuCtx | null>(null);
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const [dragOver, setDragOver] = useState<{ id: string; zona: ZonaDrop } | null>(null);
  const dragId = useRef<string | null>(null);

  const documentos = listarDocumentos(doc, 0, [], []);

  const renomear = (id: string, texto: string) => {
    aoRenomear(id, texto);
    setEditando(null);
  };

  return (
    <aside className="rmm-nav">
      <div className="rmm-nav-cabecalho">
        <span className="rmm-nav-titulo">Documentos</span>
        <button
          type="button"
          className="rmm-nav-recolher"
          title="Recolher lista de documentos"
          aria-label="Recolher lista de documentos"
          onClick={aoRecolher}
        >
          ‹
        </button>
      </div>
      {compartilhados.length > 0 && <div className="rmm-nav-secao">Meus documentos</div>}
      <Link
        className={`rmm-nav-item ${focoId === null ? 'ativo' : ''}`}
        href="/docs"
        onClick={() => aoFocar(null)}
      >
        ⌂ {rotuloRaiz}
      </Link>
      {documentos
        .filter((d) => !d.ancestrais.some((a) => recolhidos.has(a)))
        .map((d) => (
          <div
            key={d.id}
            className="rmm-nav-linha"
            style={{ paddingLeft: 4 + (d.profundidade + 1) * 12 }}
          >
            {d.temFilhosDoc ? (
              <button
                type="button"
                className="rmm-nav-seta"
                onClick={() =>
                  setRecolhidos((s) => {
                    const novo = new Set(s);
                    if (novo.has(d.id)) novo.delete(d.id);
                    else novo.add(d.id);
                    return novo;
                  })
                }
              >
                <span className={`rmm-seta ${recolhidos.has(d.id) ? '' : 'aberta'}`}>›</span>
              </button>
            ) : (
              <span className="rmm-nav-seta rmm-nav-seta-vazia" />
            )}
            {editando?.id === d.id ? (
              <input
                className="rmm-nav-input"
                value={editando.texto}
                // biome-ignore lint/a11y/noAutofocus: campo só existe durante a edição
                autoFocus
                onFocus={(e) => e.target.select()}
                onChange={(e) => setEditando({ id: d.id, texto: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') renomear(d.id, editando.texto);
                  if (e.key === 'Escape') setEditando(null);
                }}
                onBlur={() => renomear(d.id, editando.texto)}
              />
            ) : (
              <Link
                className={`rmm-nav-item ${focoId === d.id ? 'ativo' : ''} ${
                  dragOver?.id === d.id
                    ? dragOver.zona === 'filha'
                      ? 'rmm-nav-drop-filha'
                      : 'rmm-nav-drop-irma'
                    : ''
                }`}
                href={`/docs?doc=${d.id}`}
                draggable
                onClick={() => aoFocar(d.id)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  setEditando({ id: d.id, texto: d.texto });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ id: d.id, x: e.clientX, y: e.clientY });
                }}
                onDragStart={() => {
                  dragId.current = d.id;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!dragId.current || dragId.current === d.id) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  const zona = zonaDoDrop(e.clientY - r.top, r.height);
                  setDragOver((o) => (o?.id === d.id && o.zona === zona ? o : { id: d.id, zona }));
                }}
                onDragLeave={() => setDragOver((o) => (o?.id === d.id ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId.current && dragId.current !== d.id) {
                    const r = e.currentTarget.getBoundingClientRect();
                    aoMover(dragId.current, d.id, zonaDoDrop(e.clientY - r.top, r.height));
                  }
                  dragId.current = null;
                  setDragOver(null);
                }}
              >
                {d.texto}
              </Link>
            )}
          </div>
        ))}

      {compartilhados.length > 0 && (
        <>
          <div className="rmm-nav-secao">Compartilhados comigo</div>
          {compartilhados.map((c) => (
            <div key={c.documentoId} className="rmm-nav-linha" style={{ paddingLeft: 16 }}>
              <span className="rmm-nav-seta rmm-nav-seta-vazia" />
              <Link
                className="rmm-nav-item rmm-nav-compartilhado"
                href={`/docs/compartilhados/${c.documentoId}`}
                title={c.papel === 'editor' ? 'Você pode editar' : 'Você pode ver'}
              >
                <span className="rmm-nav-papel" aria-hidden>
                  {c.papel === 'editor' ? <Pencil size={13} /> : <Eye size={13} />}
                </span>
                {c.tituloMd || 'Documento sem título'}
              </Link>
            </div>
          ))}
        </>
      )}

      {menu && (
        <>
          <button
            type="button"
            className="rmm-nav-menu-fundo"
            aria-label="Fechar menu"
            onClick={() => setMenu(null)}
          />
          <div className="rmm-nav-menu" style={{ left: menu.x, top: menu.y }}>
            <button
              type="button"
              onClick={() => {
                const item = documentos.find((x) => x.id === menu.id);
                setEditando({ id: menu.id, texto: item?.texto ?? '' });
                setMenu(null);
              }}
            >
              ✎ Renomear
            </button>
            <button
              type="button"
              onClick={() => {
                aoDuplicar(menu.id);
                setMenu(null);
              }}
            >
              ⧉ Duplicar
            </button>
            <button
              type="button"
              onClick={() => {
                aoExcluir(menu.id);
                setMenu(null);
              }}
            >
              🗑 Excluir
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
