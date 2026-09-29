'use client';

import { ArrowDown, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

function Moldura({
  titulo,
  children,
  onFechar,
  onConfirmar,
  rotuloConfirmar,
  ocupado,
  perigo,
  desabilitado,
}: {
  titulo: string;
  children: ReactNode;
  onFechar: () => void;
  onConfirmar: () => void;
  rotuloConfirmar: string;
  ocupado: boolean;
  perigo?: boolean;
  desabilitado?: boolean;
}) {
  // Enter confirma, Esc fecha (padrão dos modais do TinDo).
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
      if (e.key === 'Enter' && !ocupado && !desabilitado) {
        e.preventDefault();
        onConfirmar();
      }
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onFechar, onConfirmar, ocupado, desabilitado]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
      onKeyDown={() => undefined}
    >
      <dialog
        open
        aria-modal="true"
        aria-label={titulo}
        className="static m-0 w-full max-w-lg rounded-xl border border-[#1B222C] bg-bg-elevated p-5 text-text-primary"
      >
        <h2 className="text-lg font-semibold text-text-primary">{titulo}</h2>
        <div className="mt-3 text-sm text-text-secondary">{children}</div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onFechar}
            className="h-9 rounded-md border border-border-strong px-4 text-sm hover:border-jade-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={ocupado || desabilitado}
            className={
              perigo
                ? 'h-9 rounded-md bg-[#E3546C] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50'
                : 'h-9 rounded-md bg-jade px-4 text-sm font-medium text-white hover:bg-jade-accent disabled:opacity-50'
            }
          >
            {ocupado ? 'Aguarde…' : rotuloConfirmar}
          </button>
        </div>
      </dialog>
    </div>
  );
}

export function ModalExcluir({
  conteudo,
  ocupado,
  onFechar,
  onConfirmar,
}: {
  conteudo: string;
  ocupado: boolean;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <Moldura
      titulo="Excluir do Todoist?"
      onFechar={onFechar}
      onConfirmar={onConfirmar}
      rotuloConfirmar="Excluir de vez"
      ocupado={ocupado}
      perigo
    >
      <p className="rounded-md border border-[#E3546C]/40 bg-[#E3546C]/10 p-3 text-text-primary">
        {conteudo}
      </p>
      <p className="mt-3">
        A tarefa sai do seu Todoist e{' '}
        <strong className="text-[#E3546C]">não dá para desfazer</strong>. Se ela só já foi feita,
        use Concluir.
      </p>
    </Moldura>
  );
}

export function ModalMesclar({
  atual,
  sugerida,
  tarefas,
  ocupado,
  onFechar,
  onConfirmar,
}: {
  atual: { id: string; conteudo: string };
  /** Duplicado apontado pelo vigia, se houver. */
  sugerida: string | null;
  tarefas: Array<{ id: string; conteudo: string }>;
  ocupado: boolean;
  onFechar: () => void;
  onConfirmar: (ficaId: string, saiId: string) => void;
}) {
  const outras = tarefas.filter((t) => t.id !== atual.id);
  const [outraId, setOutraId] = useState(
    sugerida && outras.some((t) => t.id === sugerida) ? sugerida : '',
  );
  const [ficaAtual, setFicaAtual] = useState(false);
  const outra = outras.find((t) => t.id === outraId) ?? null;
  const fica = ficaAtual ? atual : outra;
  const sai = ficaAtual ? outra : atual;

  return (
    <Moldura
      titulo="Mesclar tarefas"
      onFechar={onFechar}
      onConfirmar={() => fica && sai && onConfirmar(fica.id, sai.id)}
      rotuloConfirmar="Mesclar e excluir a de baixo"
      ocupado={ocupado}
      desabilitado={!outra}
      perigo
    >
      <label className="block text-xs text-text-muted">
        Mesclar com
        <select
          className="mt-1 h-9 w-full rounded-md border border-border-strong bg-bg-deep px-2 text-sm text-text-primary"
          value={outraId}
          onChange={(e) => setOutraId(e.target.value)}
        >
          <option value="">Escolha a outra tarefa…</option>
          {outras.map((t) => (
            <option key={t.id} value={t.id}>
              {t.conteudo}
              {t.id === sugerida ? ' (duplicado apontado pelo vigia)' : ''}
            </option>
          ))}
        </select>
      </label>

      {fica && sai && (
        <div className="mt-4 space-y-2">
          <div className="rounded-md border border-[#198B74]/50 bg-[#198B74]/10 p-3">
            <p className="text-xs font-medium text-[#2CAF93]">FICA</p>
            <p className="text-text-primary">{fica.conteudo}</p>
            <p className="mt-1 text-xs">Recebe o texto da outra no fim da descrição.</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs">
            <ArrowDown size={14} aria-hidden="true" />
            <button
              type="button"
              onClick={() => setFicaAtual((v) => !v)}
              className="underline hover:text-jade-accent"
            >
              Inverter qual fica
            </button>
          </div>
          <div className="rounded-md border border-[#E3546C]/40 bg-[#E3546C]/10 p-3">
            <p className="flex items-center gap-1 text-xs font-medium text-[#E3546C]">
              <Trash2 size={12} aria-hidden="true" /> É EXCLUÍDA DO TODOIST
            </p>
            <p className="text-text-primary">{sai.conteudo}</p>
            <p className="mt-1 text-xs">Não dá para desfazer.</p>
          </div>
        </div>
      )}
    </Moldura>
  );
}
