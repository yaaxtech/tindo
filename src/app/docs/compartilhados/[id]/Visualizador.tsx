'use client';

// RoadMapMind — Fase 2: visão de um documento compartilhado comigo.
// Fatia 1b: só-leitura (leitor). Fatia 4: EDIÇÃO quando o papel é 'editor' —
// autosave via PUT /api/docs/compartilhados/[id] → RPC guarded (a escrita é
// confinada à subárvore no banco). Rota própria: NÃO mexe no editor do dono.
//
// Limitações conhecidas desta fatia (documentadas na frente): sem mapa (só o
// outline); linha espelhada-de-fora aparece mas não persiste edição (a RPC a
// ignora — só-leitura de fato); sincronia ao vivo de espelho interno e criação
// de espelho pelo convidado ficam para depois.

import '../../roadmapmind.css';

import {
  type BlocoBN,
  type DocEspelho,
  blocosParaLinhas,
  linhasParaBlocos,
} from '@/services/doc-markdown';
import type { PapelEfetivo } from '@/types/compartilhar';
import type { DocLinha } from '@/types/doc';
import type { Block, BlockNoteEditor, PartialBlock } from '@blocknote/core';
import { pt } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '../../Editor';
import FaixaPapel from '../../FaixaPapel';

type Estado = 'carregando' | 'ok' | 'sem-acesso' | 'erro';
type Status = 'ok' | 'salvando' | 'erro';

const ROTULOS: Record<Status, string> = {
  ok: '✓ Sincronizado',
  salvando: 'Salvando…',
  erro: 'Erro ao salvar',
};

// ---- helpers de tarefa (idênticos aos do editor do dono) ---------------------
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

export default function Visualizador({ documentoId }: { documentoId: string }) {
  const editor = useCreateBlockNote({ dictionary: pt });
  const [estado, setEstado] = useState<Estado>('carregando');
  const [papel, setPapel] = useState<PapelEfetivo>(null);
  const [titulo, setTitulo] = useState('Documento compartilhado');
  const [status, setStatus] = useState<Status>('ok');
  const [aviso, setAviso] = useState<{ blockId: string; abertas: number } | null>(null);
  // Obsidian por padrão; acompanha o tema do sistema (sem toggle nesta fatia).
  const [tema, setTema] = useState<'dark' | 'light'>('dark');

  const editavel = papel === 'editor';
  const carregado = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checksRef = useRef<Map<string, boolean>>(new Map());
  const revertendo = useRef(false);
  // ids dos BLOCOS-espelho (excluídos do save: não são linhas reais)
  const espelhoIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    setTema(mq.matches ? 'light' : 'dark');
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/docs/compartilhados/${documentoId}`);
        const data = await res.json();
        if (!vivo) return;
        if (res.status === 403) {
          setEstado('sem-acesso');
          return;
        }
        if (!res.ok) throw new Error(data?.erro ?? 'Falha ao abrir o documento.');
        setPapel((data.papel ?? null) as PapelEfetivo);
        if (data.tituloMd) setTitulo(data.tituloMd as string);
        const espelhos = (data.espelhos ?? []) as DocEspelho[];
        espelhoIdsRef.current = new Set(espelhos.map((e) => e.id));
        const blocos = linhasParaBlocos((data.linhas ?? []) as DocLinha[], documentoId, espelhos);
        if (blocos.length > 0) {
          editor.replaceBlocks(editor.document, blocos as unknown as PartialBlock[]);
        }
        checksRef.current = snapshotChecks(editor.document, new Map());
        carregado.current = true;
        setEstado('ok');
      } catch {
        if (vivo) setEstado('erro');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [editor, documentoId]);

  const salvar = useCallback(async () => {
    setStatus('salvando');
    try {
      const linhas = blocosParaLinhas(
        editor.document as unknown as BlocoBN[],
        documentoId,
        espelhoIdsRef.current,
      );
      const res = await fetch(`/api/docs/compartilhados/${documentoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linhas }),
      });
      setStatus(res.ok ? 'ok' : 'erro');
    } catch {
      setStatus('erro');
    }
  }, [editor, documentoId]);

  const agendarSalvar = useCallback((fn: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, 800);
  }, []);

  // trava pai/filhas (mesma regra do editor do dono) + autosave
  const onChange = useCallback(() => {
    if (revertendo.current || !carregado.current) return;
    const documento = editor.document;
    const atual = snapshotChecks(documento, new Map());
    for (const [id, checked] of atual) {
      if (checksRef.current.get(id) === false && checked === true) {
        const block = acharBloco(documento, id);
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
    agendarSalvar(() => void salvar());
  }, [editor, salvar, agendarSalvar]);

  const confirmarFechamento = useCallback(() => {
    if (!aviso) return;
    const block = acharBloco(editor.document, aviso.blockId);
    if (block) {
      revertendo.current = true;
      fecharSubarvore(editor, block);
      editor.updateBlock(block, { props: { checked: true } });
      revertendo.current = false;
      checksRef.current = snapshotChecks(editor.document, new Map());
      void salvar();
    }
    setAviso(null);
  }, [aviso, editor, salvar]);

  return (
    <div className={`rmm-root rmm-tema-${tema} rmm-compartilhado`}>
      <div className="rmm-compartilhado-topo">
        <Link href="/docs" className="rmm-voltar">
          ‹ Voltar aos meus documentos
        </Link>
        {editavel && estado === 'ok' && (
          <span className="rmm-status" data-status={status}>
            {ROTULOS[status]}
          </span>
        )}
      </div>

      {estado === 'ok' && <FaixaPapel papel={papel} />}

      {estado === 'sem-acesso' && (
        <div className="rmm-compartilhado-aviso">
          Este documento não está compartilhado com você (ou o acesso foi revogado).
        </div>
      )}
      {estado === 'erro' && (
        <div className="rmm-compartilhado-aviso">Não consegui abrir este documento agora.</div>
      )}

      {(estado === 'carregando' || estado === 'ok') && (
        <main className="rmm-editor rmm-compartilhado-corpo">
          <h1 className="rmm-doc-titulo">{titulo}</h1>
          <Editor
            editor={editor}
            tema={tema}
            editavel={editavel}
            onChange={editavel ? onChange : undefined}
          />
        </main>
      )}

      {aviso && (
        // biome-ignore lint/a11y/useSemanticElements: modal custom com backdrop próprio
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
