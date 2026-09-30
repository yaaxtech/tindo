'use client';

import type { TarefaResumo } from '@/services/triagem-revisao';
import { CheckCircle2, Info, Merge, RotateCcw, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dataHora.format(d);
}

/** Detalhes da tarefa ao passar o mouse (ou tocar no ícone, no celular). */
export function Detalhes({ item }: { item: TarefaResumo }) {
  const [aberto, setAberto] = useState(false);
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label="Detalhes da tarefa"
        onClick={() => setAberto((v) => !v)}
        onBlur={() => setAberto(false)}
        className="ml-1 text-text-muted hover:text-jade-accent"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className={`${aberto ? 'block' : 'hidden'} absolute left-0 top-6 z-40 w-72 rounded-lg border border-border-strong bg-bg-deep p-3 text-xs text-text-secondary shadow-xl group-hover:block`}
      >
        <span className="block font-medium text-text-primary">{item.conteudo}</span>
        {item.descricao && (
          <span className="mt-1 block whitespace-pre-line text-text-muted">{item.descricao}</span>
        )}
        <span className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <span className="text-text-muted">Projeto</span>
          <span>{item.projetoAtual}</span>
          <span className="text-text-muted">Data</span>
          <span>
            {item.vencimentoTexto ?? formatarData(item.vencimento)}
            {item.recorrente ? ' (recorrente)' : ''}
          </span>
          <span className="text-text-muted">Criada em</span>
          <span>{formatarData(item.criadaEm)}</span>
          <span className="text-text-muted">Criada por</span>
          <span>{item.criadaPor ?? 'não sei'}</span>
        </span>
      </span>
    </span>
  );
}

export type AcaoCartao = 'concluir' | 'reabrir' | 'excluir' | 'mesclar';

/** O mínimo que uma ação precisa saber da tarefa. */
export interface AlvoAcao {
  tarefaId: string;
  conteudo: string;
  duplicadoDe?: string;
}

/** Concluir / Mesclar / Excluir (ou Desfazer, depois de concluir). */
export function BarraAcoes({
  alvo,
  concluida,
  aoAcao,
  children,
}: {
  alvo: AlvoAcao;
  concluida: boolean;
  aoAcao: (acao: AcaoCartao, alvo: AlvoAcao) => void;
  children?: ReactNode;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#1B222C] pt-3 text-xs">
      {concluida ? (
        <button
          type="button"
          onClick={() => aoAcao('reabrir', alvo)}
          className="flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 hover:border-jade-accent"
        >
          <RotateCcw size={12} aria-hidden="true" /> Concluída. Desfazer
        </button>
      ) : (
        <>
          {children}
          <button
            type="button"
            onClick={() => aoAcao('concluir', alvo)}
            className="flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 hover:border-jade-accent hover:text-jade-accent"
          >
            <CheckCircle2 size={12} aria-hidden="true" /> Concluir
          </button>
          <button
            type="button"
            onClick={() => aoAcao('mesclar', alvo)}
            className={
              alvo.duplicadoDe
                ? 'flex items-center gap-1 rounded-md border border-[#F2B94B]/60 px-2 py-1 text-[#F2B94B] hover:opacity-80'
                : 'flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 hover:border-jade-accent'
            }
          >
            <Merge size={12} aria-hidden="true" /> Mesclar
          </button>
          <button
            type="button"
            onClick={() => aoAcao('excluir', alvo)}
            className="flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 hover:border-[#E3546C] hover:text-[#E3546C]"
          >
            <Trash2 size={12} aria-hidden="true" /> Excluir
          </button>
        </>
      )}
    </div>
  );
}
