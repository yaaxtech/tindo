'use client';

// RoadMapMind — Fase 2 / Fatia 5: leitor público só-leitura (anônimo).
// Carrega a subárvore pela API pública (RPC anon guarded no banco) e renderiza
// o BlockNote editable=false. Token restrito/inexistente → aviso "indisponível".

import '../../roadmapmind.css';

import { type DocEspelho, linhasParaBlocos } from '@/services/doc-markdown';
import type { DocLinha } from '@/types/doc';
import type { PartialBlock } from '@blocknote/core';
import { pt } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import { Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import Editor from '../../Editor';

type Estado = 'carregando' | 'ok' | 'indisponivel' | 'erro';

interface RespostaPublica {
  raizId: string;
  titulo: string;
  linhas: DocLinha[];
  espelhos: DocEspelho[];
}

export default function LeitorPublico({ token }: { token: string }) {
  const editor = useCreateBlockNote({ dictionary: pt });
  const [estado, setEstado] = useState<Estado>('carregando');
  const [titulo, setTitulo] = useState('Documento compartilhado');
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
        const res = await fetch(`/api/docs/compartilhado/${token}`);
        if (!vivo) return;
        if (res.status === 404) {
          setEstado('indisponivel');
          return;
        }
        if (!res.ok) throw new Error('falha');
        const data = (await res.json()) as RespostaPublica;
        if (!vivo) return;
        if (data.titulo) setTitulo(data.titulo);
        const blocos = linhasParaBlocos(data.linhas ?? [], data.raizId, data.espelhos ?? []);
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
  }, [editor, token]);

  return (
    <div className={`rmm-root rmm-tema-${tema} rmm-compartilhado rmm-publico`}>
      <div className="rmm-publico-topo">
        <span className="rmm-publico-selo">
          <Eye aria-hidden="true" size={14} /> Somente leitura
        </span>
      </div>

      {estado === 'indisponivel' && (
        <div className="rmm-compartilhado-aviso">
          Documento indisponível. O link pode ter sido desativado ou substituído.
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

      {estado === 'ok' && <footer className="rmm-publico-rodape">Criado no RoadMapMind</footer>}
    </div>
  );
}
