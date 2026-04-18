'use client';

import { motion } from 'framer-motion';
import { Check, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Tarefa } from '@/types/domain';
import { cn, formatRelativeDate } from '@/lib/utils';

interface TaskCardProps {
  tarefa: Tarefa;
  onConcluir: () => void;
  onExcluir: () => void;
  onEditar: () => void;
  onDependencia: () => void;
  onAdicionar: () => void;
  className?: string;
}

export function TaskCard({
  tarefa,
  onConcluir,
  onExcluir,
  onEditar,
  onDependencia,
  onAdicionar,
  className,
}: TaskCardProps) {
  const corProjeto = tarefa.projeto?.cor ?? '#2CAF93';
  return (
    <motion.article
      layout
      className={cn(
        'grad-card relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border-strong p-6 shadow-card no-select',
        className,
      )}
      aria-label={`Tarefa: ${tarefa.titulo}`}
    >
      {/* Barra topo: projeto + tags */}
      <header className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        {tarefa.projeto && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium"
            style={{ borderColor: `${corProjeto}55`, color: corProjeto }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: corProjeto }} />
            {tarefa.projeto.nome}
          </span>
        )}
        {tarefa.tipo === 'lembrete' && (
          <span className="rounded-full bg-jade-dim/40 px-2.5 py-1 font-medium text-jade-accent">
            · lembrete
          </span>
        )}
        {tarefa.tags.slice(0, 3).map((tag) => (
          <span
            key={tag.id}
            className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
            style={{ borderColor: `${tag.cor}55`, color: tag.cor }}
          >
            {tag.nome}
          </span>
        ))}
      </header>

      {/* Título */}
      <h2 className="text-balance text-2xl font-semibold leading-tight text-text-primary md:text-3xl">
        {tarefa.titulo}
      </h2>

      {tarefa.descricao && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-text-secondary">
          {tarefa.descricao}
        </p>
      )}

      {/* Chips */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Chip label="Data" valor={formatRelativeDate(tarefa.dataVencimento)} />
        <Chip label="Prazo" valor={formatRelativeDate(tarefa.prazoConclusao)} />
        <Chip label="Nota" valor={String(tarefa.nota)} destaque />
      </div>

      {tarefa.dependenciaTarefaId && (
        <p className="mt-4 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
          🔗 Depende de outra tarefa
        </p>
      )}

      <div className="flex-1" />

      {/* Ação primária */}
      <button
        type="button"
        onClick={onConcluir}
        className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-md grad-jade text-base font-semibold text-text-inverse shadow-glow transition-transform ease-standard duration-fast hover:scale-[1.01] active:scale-[0.99]"
        aria-label="Concluir tarefa"
      >
        <Check className="h-5 w-5" strokeWidth={3} />
        Concluir
        <kbd className="ml-2 rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-medium opacity-70">
          Space
        </kbd>
      </button>

      {/* Botões secundários */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <IconBtn aria-label="Excluir" onClick={onExcluir} variant="danger">
          <Trash2 className="h-4 w-4" />
        </IconBtn>
        <IconBtn aria-label="Dependência" onClick={onDependencia}>
          <Link2 className="h-4 w-4" />
        </IconBtn>
        <IconBtn aria-label="Editar" onClick={onEditar}>
          <Pencil className="h-4 w-4" />
        </IconBtn>
        <IconBtn aria-label="Adicionar" onClick={onAdicionar} variant="accent">
          <Plus className="h-4 w-4" />
        </IconBtn>
      </div>

      {/* Hints */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-center text-[11px] leading-snug text-text-muted">
        <span>← voltar</span>
        <span>pular →</span>
        <span>↑ adiar manual</span>
        <span>↓ adiar auto</span>
      </div>
    </motion.article>
  );
}

function Chip({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-md border border-border-strong bg-bg-surface p-3',
        destaque && 'border-jade-accent/60 bg-jade-dim/30',
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</span>
      <span
        className={cn(
          'mt-1 text-lg font-bold',
          destaque ? 'text-jade-accent' : 'text-text-primary',
        )}
      >
        {valor}
      </span>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  variant,
  ...rest
}: React.ComponentProps<'button'> & { variant?: 'danger' | 'accent' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-strong bg-bg-surface text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary',
        variant === 'danger' && 'hover:border-danger/50 hover:text-danger',
        variant === 'accent' && 'border-jade-accent/40 text-jade-accent hover:bg-jade-dim/40',
      )}
    >
      {children}
    </button>
  );
}
