'use client';

// RoadMapMind — Editor outline (BlockNote) com persistência (Fatia 1).
// Carrega via GET /api/docs, salva automático (debounce) via PUT /api/docs.
// Fatias seguintes: outline rico (2), tarefas (3), mindmap (4-5).

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

  return (
    <div className="rmm-root">
      <header className="rmm-topbar">
        <span className="rmm-brand">RoadMapMind</span>
        <span className="rmm-status" data-status={status}>
          {ROTULOS[status]}
        </span>
        <button type="button" className="rmm-btn" onClick={() => void salvar()}>
          Salvar
        </button>
      </header>
      <main className="rmm-editor">
        <h1 className="rmm-doc-titulo">{titulo}</h1>
        <BlockNoteView editor={editor} theme="dark" onChange={onChange} />
      </main>
    </div>
  );
}
