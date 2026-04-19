'use client';

import { type Toast, useToasts } from '@/stores/toasts';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock3, Undo2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function Toaster() {
  const lista = useToasts((s) => s.lista);
  return (
    <output
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+16px)]"
    >
      <div className="flex w-full max-w-md flex-col-reverse gap-2">
        <AnimatePresence initial={false}>
          {lista.map((t) => (
            <ToastItem key={t.id} toast={t} />
          ))}
        </AnimatePresence>
      </div>
    </output>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const remove = useToasts((s) => s.remove);
  const barRef = useRef<HTMLDivElement | null>(null);
  const duracao = toast.duracaoMs ?? 5000;

  useEffect(() => {
    const timer = window.setTimeout(() => remove(toast.id), duracao);
    return () => window.clearTimeout(timer);
  }, [duracao, remove, toast.id]);

  const Icon =
    toast.icone === 'adiar'
      ? Clock3
      : toast.icone === 'ok'
        ? Undo2
        : toast.icone === 'alerta'
          ? X
          : Clock3;

  return (
    <motion.div
      layout
      initial={{ y: 24, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 8, opacity: 0, scale: 0.98, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      className="pointer-events-auto overflow-hidden rounded-xl border border-border-strong bg-bg-elevated/95 shadow-card backdrop-blur"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jade-dim/40 text-jade-accent">
          <Icon size={16} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{toast.titulo}</p>
          {toast.descricao ? (
            <p className="truncate text-xs text-text-secondary">{toast.descricao}</p>
          ) : null}
        </div>
        {toast.acao ? (
          <button
            type="button"
            onClick={async () => {
              await toast.acao?.onClick();
              remove(toast.id);
            }}
            className="ml-1 inline-flex h-8 items-center gap-1 rounded-md border border-jade-accent/40 bg-jade-dim/30 px-3 text-xs font-semibold text-jade-accent transition-colors hover:bg-jade-dim/50"
          >
            <Undo2 size={12} />
            {toast.acao.label}
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => remove(toast.id)}
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <X size={14} />
        </button>
      </div>
      <div className="relative h-0.5 w-full bg-bg-surface">
        <motion.div
          ref={barRef}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duracao / 1000, ease: 'linear' }}
          className="absolute inset-y-0 left-0 bg-jade-accent/70"
        />
      </div>
    </motion.div>
  );
}
