'use client';

// RoadMapMind — Editor outline (BlockNote) com persistência.
// Fatia 1: carregar/salvar. Fatia 2: guias por nível (CSS), numeração 1.1.1,
// dobrar linha, colar/copiar markdown. Fatia 3 (tarefas) e 4-5 (mapa) a seguir.

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './roadmapmind.css';

import { type BlocoBN, blocosParaLinhas, linhasParaBlocos } from '@/services/doc-markdown';
import type { DocLinha } from '@/types/doc';
import type { PartialBlock } from '@blocknote/core';
import { pt } from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Status = 'carregando' | 'ok' | 'salvando' | 'erro';

const ROTULOS: Record<Status, string> = {
  carregando: 'Carregando…',
  ok: '✓ Sincronizado',
  salvando: 'Salvando…',
  erro: 'Erro ao salvar',
};

export default function Editor() {
  const editor = useCreateBlockNote({ dictionary: pt });
  const [raizId, setRaizId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('RoadMapMind');
  const [status, setStatus] = useState<Status>('carregando');
  const [modoNumeros, setModoNumeros] = useState(false);
  const [dobradas, setDobradas] = useState<Set<string>>(new Set());
  const [copiado, setCopiado] = useState(false);
  const carregado = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // carregar o documento do usuário (garante a raiz no servidor)
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch('/api/docs');
        const data = await res.json();
        if (!vivo) return;
        if (!res.ok) throw new Error(data?.erro ?? 'Falha ao carregar');
        setRaizId(data.raiz.id);
        if (data.raiz.textoMd) setTitulo(data.raiz.textoMd);
        const blocos = linhasParaBlocos((data.linhas ?? []) as DocLinha[], data.raiz.id);
        if (blocos.length > 0) {
          editor.replaceBlocks(editor.document, blocos as unknown as PartialBlock[]);
        }
        carregado.current = true;
        setStatus('ok');
      } catch {
        if (vivo) setStatus('erro');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [editor]);

  const salvar = useCallback(async () => {
    if (!raizId) return;
    setStatus('salvando');
    try {
      const linhas = blocosParaLinhas(editor.document as unknown as BlocoBN[], raizId);
      const res = await fetch('/api/docs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raizId, linhas }),
      });
      setStatus(res.ok ? 'ok' : 'erro');
    } catch {
      setStatus('erro');
    }
  }, [editor, raizId]);

  // salva automático 800ms após parar de digitar
  const onChange = useCallback(() => {
    if (!carregado.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void salvar(), 800);
  }, [salvar]);

  const copiarMarkdown = useCallback(async () => {
    const md = await editor.blocksToMarkdownLossy(editor.document);
    try {
      await navigator.clipboard.writeText(md);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard bloqueado — ignora */
    }
  }, [editor]);

  const colarMarkdown = useCallback(async () => {
    try {
      const md = await navigator.clipboard.readText();
      if (!md.trim()) return;
      const blocos = await editor.tryParseMarkdownToBlocks(md);
      editor.replaceBlocks(editor.document, blocos);
      await salvar();
    } catch {
      setStatus('erro');
    }
  }, [editor, salvar]);

  // clicar na faixa do marcador (~26px) de uma linha com filhos = dobra/expande
  const aoClicarNoDoc = useCallback((e: React.MouseEvent) => {
    const alvo = (e.target as HTMLElement).closest('.bn-block-content') as HTMLElement | null;
    if (!alvo) return;
    const outer = alvo.closest('.bn-block-outer') as HTMLElement | null;
    const id = outer?.getAttribute('data-id');
    if (!id) return;
    if (e.clientX - alvo.getBoundingClientRect().left > 26) return;
    const temFilhos = outer?.querySelector(':scope > .bn-block > .bn-block-group') !== null;
    if (!temFilhos) return;
    e.preventDefault();
    e.stopPropagation();
    setDobradas((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);

  return (
    <div className="rmm-root">
      <header className="rmm-topbar">
        <span className="rmm-brand">RoadMapMind</span>
        <div className="rmm-actions">
          <button
            type="button"
            className={modoNumeros ? 'ativo' : ''}
            onClick={() => setModoNumeros((m) => !m)}
          >
            {modoNumeros ? '• Marcadores' : '1.1 Números'}
          </button>
          <button type="button" onClick={() => void copiarMarkdown()}>
            {copiado ? '✓ Copiado' : '⧉ Markdown'}
          </button>
          <button type="button" onClick={() => void colarMarkdown()}>
            ↧ Colar
          </button>
        </div>
        <span className="rmm-status" data-status={status}>
          {ROTULOS[status]}
        </span>
        <button type="button" className="rmm-btn" onClick={() => void salvar()}>
          Salvar
        </button>
      </header>

      {/* linhas dobradas: esconde os filhos e troca o marcador por › */}
      {dobradas.size > 0 && (
        <style>
          {[...dobradas]
            .map(
              (id) => `
              .bn-block-outer[data-id="${id}"] > .bn-block > .bn-block-group { display: none; }
              .bn-block-outer[data-id="${id}"] > .bn-block > .bn-block-content::before {
                content: '›' !important; color: #2caf93 !important; font-weight: 700;
              }`,
            )
            .join('\n')}
        </style>
      )}

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: captura de clique no marcador (dobrar) */}
      <main
        className={`rmm-editor ${modoNumeros ? 'rmm-numeros' : ''}`}
        onClickCapture={aoClicarNoDoc}
      >
        <h1 className="rmm-doc-titulo">{titulo}</h1>
        <BlockNoteView editor={editor} theme="dark" onChange={onChange} />
      </main>
    </div>
  );
}
