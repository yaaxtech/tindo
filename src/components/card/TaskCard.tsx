'use client';

import { corUrgencia } from '@/lib/urgency-color';
import { cn, formatRelativeDate } from '@/lib/utils';
import type { Tarefa } from '@/types/domain';
import { motion } from 'framer-motion';
import { Calendar, Check, Link2, List, Pencil, Plus, Trash2 } from 'lucide-react';

export type CampoData = 'data_vencimento' | 'prazo_conclusao';

interface TaskCardProps {
  tarefa: Tarefa;
  onConcluir: () => void;
  onExcluir: () => void;
  onEditar: () => void;
  onDependencia: () => void;
  onAdicionar: () => void;
  onListar: () => void;
  onSalvarData?: (campo: CampoData, ate: string | null) => void;
  className?: string;
}

export function TaskCard({
  tarefa,
  onConcluir,
  onExcluir,
  onEditar,
  onDependencia,
  onAdicionar,
  onListar,
  onSalvarData,
  className,
}: TaskCardProps) {
  const corProjeto = tarefa.projeto?.cor ?? '#2CAF93';
  const urg = corUrgencia(tarefa.nota);

  return (
    <motion.article
      layout
      className={cn(
        'grad-card relative flex h-full w-full flex-col overflow-hidden rounded-xl border p-6 no-select',
        className,
      )}
      style={{
        borderColor: urg.borderColor,
        boxShadow: `0 10px 30px rgba(0,0,0,0.35), 0 0 0 3px ${urg.ring}, 0 0 ${20 + urg.intensity * 40}px ${urg.glow}`,
      }}
      aria-label={`Tarefa: ${tarefa.titulo}`}
    >
      {/* Overlay de urgência (tingimento vermelho quando nota alta) */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl"
        aria-hidden
        style={{
          background:
            urg.intensity > 0
              ? `radial-gradient(ellipse at top, hsla(${urg.hue}, 80%, 50%, ${urg.intensity * 0.12}) 0%, transparent 60%)`
              : 'transparent',
        }}
      />

      {/* Conteúdo precisa ficar acima do overlay */}
      <div className="relative flex h-full flex-col">
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
          {onSalvarData ? (
            <ChipButton
              label="Data"
              valor={formatRelativeDate(tarefa.dataVencimento)}
              aria-label="Editar data de vencimento"
              onClick={() => onSalvarData('data_vencimento', tarefa.dataVencimento ?? null)}
            />
          ) : (
            <Chip label="Data" valor={formatRelativeDate(tarefa.dataVencimento)} />
          )}
          {onSalvarData ? (
            <ChipButton
              label="Prazo"
              valor={formatRelativeDate(tarefa.prazoConclusao)}
              aria-label="Editar prazo de conclusão"
              onClick={() => onSalvarData('prazo_conclusao', tarefa.prazoConclusao ?? null)}
            />
          ) : (
            <Chip label="Prazo" valor={formatRelativeDate(tarefa.prazoConclusao)} />
          )}
          <Chip
            label="Nota"
            valor={String(tarefa.nota)}
            corValor={urg.borderColor}
            corFundo={`hsla(${urg.hue}, 70%, 20%, ${0.4 + urg.intensity * 0.3})`}
            corBorda={urg.borderColor}
          />
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
          <IconBtn aria-label="Ver lista" onClick={onListar}>
            <List className="h-4 w-4" />
          </IconBtn>
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
          <span>← avançar</span>
          <span>voltar →</span>
          <span>↑ adiar manual</span>
          <span>↓ adiar auto</span>
        </div>
      </div>
    </motion.article>
  );
}

interface ChipProps {
  label: string;
  valor: string;
  corValor?: string;
  corFundo?: string;
  corBorda?: string;
}

function Chip({ label, valor, corValor, corFundo, corBorda }: ChipProps) {
  return (
    <div
      className="flex flex-col items-center rounded-md border p-3"
      style={{
        borderColor: corBorda ?? 'var(--border-strong)',
        background: corFundo ?? 'var(--bg-surface)',
      }}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span className="mt-1 text-lg font-bold" style={{ color: corValor ?? 'var(--text-primary)' }}>
        {valor}
      </span>
    </div>
  );
}

interface ChipButtonProps extends React.ComponentProps<'button'> {
  label: string;
  valor: string;
}

function ChipButton({ label, valor, ...rest }: ChipButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'flex flex-col items-center rounded-md border p-3 transition-colors',
        'border-border-strong bg-bg-surface',
        'hover:border-jade-accent/50 hover:bg-jade-dim/20',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
        'group',
      )}
    >
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-text-muted group-hover:text-jade-accent">
        {label}
        <Calendar className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-70" />
      </span>
      <span className="mt-1 text-lg font-bold text-text-primary">{valor}</span>
    </button>
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
