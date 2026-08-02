'use client';

// RoadMapMind — Fase 2 (Fatia 1b): visão SÓ-LEITURA de um documento
// compartilhado comigo. Rota própria (não mexe no editor do dono): carrega a
// subárvore pela API guarded e renderiza o BlockNote com editable=false.

import '../../roadmapmind.css';

import { type DocEspelho, linhasParaBlocos } from '@/services/doc-markdown';
import type { PapelEfetivo } from '@/types/compartilhar';
import type { DocLinha } from '@/types/doc';
import type { PartialBlock } from '@blocknote/core';
import { pt } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Editor from '../../Editor';
import FaixaPapel from '../../FaixaPapel';

type Estado = 'carregando' | 'ok' | 'sem-acesso' | 'erro';

export default function Visualizador({ documentoId }: { documentoId: string }) {
  const editor = useCreateBlockNote({ dictionary: pt });
  const [estado, setEstado] = useState<Estado>('carregando');
  const [papel, setPapel] = useState<PapelEfetivo>(null);
  const [titulo, setTitulo] = useState('Documento compartilhado');
  // Obsidian por padrão; acompanha o tema do sistema (sem toggle nesta fatia).
  const [tema, setTema] = useState<'dark' | 'light'>('dark');

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
        const blocos = linhasParaBlocos(
          (data.linhas ?? []) as DocLinha[],
          documentoId,
          (data.espelhos ?? []) as DocEspelho[],
        );
        if (blocos.length > 0) {
          editor.replaceBlocks(editor.document, blocos as unknown as PartialBlock[]);
        }
        setEstado('ok');
      } catch {
        if (vivo) setEstado('erro');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [editor, documentoId]);

  return (
    <div className={`rmm-root rmm-tema-${tema} rmm-compartilhado`}>
      <div className="rmm-compartilhado-topo">
        <Link href="/docs" className="rmm-voltar">
          ‹ Voltar aos meus documentos
        </Link>
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
          <Editor editor={editor} tema={tema} editavel={false} />
        </main>
      )}
    </div>
  );
}
