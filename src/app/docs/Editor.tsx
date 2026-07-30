'use client';

// RoadMapMind — Editor outline (BlockNote) com persistência.
// Fatia 1: carregar/salvar. Fatia 2: guias por nível, numeração, dobrar, markdown.
// Fatia 3: tarefas (checkbox) com trava pai/filhas e concluir em cascata.
// Fatias 4-5 (mapa) a seguir.

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './roadmapmind.css';

import { type BlocoBN, blocosParaLinhas, linhasParaBlocos } from '@/services/doc-markdown';
import type { DocLinha } from '@/types/doc';
import type { Block, BlockNoteEditor, PartialBlock } from '@blocknote/core';
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

// ---- helpers de tarefa (operam sobre a árvore de blocos do BlockNote) --------
function acharBloco(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    const achado = acharBloco(b.children ?? [], id);
    if (achado) return achado;
  }
  return null;
}

function filhasAbertas(block: Block): number {
  let n = 0;
  for (const child of block.children ?? []) {
    if (child.type === 'checkListItem' && child.props.checked === false) n += 1;
    n += filhasAbertas(child);
  }
  return n;
}

function fecharSubarvore(editor: BlockNoteEditor, block: Block): void {
  if (block.type === 'checkListItem' && block.props.checked === false) {
    editor.updateBlock(block, { props: { checked: true } });
  }
  for (const child of block.children ?? []) fecharSubarvore(editor, child);
}

function snapshotChecks(blocks: Block[], acc: Map<string, boolean>): Map<string, boolean> {
  for (const b of blocks) {
    if (b.type === 'checkListItem') acc.set(b.id, b.props.checked === true);
    snapshotChecks(b.children ?? [], acc);
  }
  return acc;
}

function contarTarefas(blocks: Block[]): { total: number; feitas: number } {
  let total = 0;
  let feitas = 0;
  for (const b of blocks) {
    if (b.type === 'checkListItem') {
      total += 1;
      if (b.props.checked === true) feitas += 1;
    }
    const sub = contarTarefas(b.children ?? []);
    total += sub.total;
    feitas += sub.feitas;
  }
  return { total, feitas };
}

export default function Editor() {
  const editor = useCreateBlockNote({ dictionary: pt });
  const [raizId, setRaizId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('RoadMapMind');
  const [status, setStatus] = useState<Status>('carregando');
  const [modoNumeros, setModoNumeros] = useState(false);
  const [dobradas, setDobradas] = useState<Set<string>>(new Set());
  const [copiado, setCopiado] = useState(false);
  const [progresso, setProgresso] = useState({ total: 0, feitas: 0 });
  const [aviso, setAviso] = useState<{ blockId: string; abertas: number } | null>(null);
  const carregado = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checksRef = useRef<Map<string, boolean>>(new Map());
  const revertendo = useRef(false);

  const agendarSalvar = useCallback((fn: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, 800);
  }, []);

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
        checksRef.current = snapshotChecks(editor.document, new Map());
        setProgresso(contarTarefas(editor.document));
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

  // a cada mudança: trava pai/filhas (reverte marca se houver filha aberta) + autosave
  const onChange = useCallback(() => {
    if (revertendo.current || !carregado.current) return;
    const doc = editor.document;
    const atual = snapshotChecks(doc, new Map());
    for (const [id, checked] of atual) {
      if (checksRef.current.get(id) === false && checked === true) {
        const block = acharBloco(doc, id);
        if (block) {
          const abertas = filhasAbertas(block);
          if (abertas > 0) {
            revertendo.current = true;
            editor.updateBlock(block, { props: { checked: false } });
            revertendo.current = false;
            atual.set(id, false);
            setAviso({ blockId: id, abertas });
          }
        }
      }
    }
    checksRef.current = atual;
    setProgresso(contarTarefas(editor.document));
    agendarSalvar(() => void salvar());
  }, [editor, salvar, agendarSalvar]);

  // "Concluir tudo": fecha a subárvore inteira e marca o pai
  const confirmarFechamento = useCallback(() => {
    if (!aviso) return;
    const block = acharBloco(editor.document, aviso.blockId);
    if (block) {
      revertendo.current = true;
      fecharSubarvore(editor, block);
      editor.updateBlock(block, { props: { checked: true } });
      revertendo.current = false;
      checksRef.current = snapshotChecks(editor.document, new Map());
      setProgresso(contarTarefas(editor.document));
      void salvar();
    }
    setAviso(null);
  }, [aviso, editor, salvar]);

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
        {progresso.total > 0 && (
          <span className="rmm-chip" title="Tarefas concluídas / total">
            ✓ {progresso.feitas}/{progresso.total}
          </span>
        )}
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

      {aviso && (
        <div className="rmm-modal-backdrop" role="dialog" aria-modal="true">
          <div className="rmm-modal">
            <h3>
              Esta tarefa ainda tem {aviso.abertas} subtarefa{aviso.abertas > 1 ? 's' : ''} aberta
              {aviso.abertas > 1 ? 's' : ''}
            </h3>
            <p>Para concluir a tarefa-mãe, todas as subtarefas precisam estar concluídas.</p>
            <div className="rmm-modal-actions">
              <button type="button" className="rmm-btn-secundario" onClick={() => setAviso(null)}>
                Cancelar
              </button>
              <button type="button" className="rmm-btn-primario" onClick={confirmarFechamento}>
                Concluir tudo ({aviso.abertas + 1})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
