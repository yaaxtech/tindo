'use client';

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ContadorLembretesProps {
  total: number;
}

/**
 * Badge motivador que destaca quantos lembretes ainda faltam.
 * Neurociência: ver o número decrementando em tempo real libera dopamina
 * e incentiva o usuário a zerar lembretes antes de partir para tarefas maiores.
 */
export function ContadorLembretes({ total }: ContadorLembretesProps) {
  const [decrementou, setDecrementou] = useState(false);
  const anterior = useRef(total);

  useEffect(() => {
    if (total < anterior.current) {
      setDecrementou(true);
      const id = window.setTimeout(() => setDecrementou(false), 700);
      return () => window.clearTimeout(id);
    }
    anterior.current = total;
  }, [total]);

  if (total === 0) {
    return (
      <AnimatePresence>
        <motion.span
          key="zerado"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-jade-accent/40 bg-jade-dim/30 px-3 py-1 text-xs font-medium text-jade-accent"
          aria-label="Todos os lembretes concluídos"
        >
          <Sparkles size={12} strokeWidth={2.4} />
          Lembretes zerados
        </motion.span>
      </AnimatePresence>
    );
  }

  return (
    <motion.span
      layout
      animate={decrementou ? { scale: [1, 1.12, 1] } : { scale: 1 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        decrementou
          ? 'border-jade-accent bg-jade-dim/40 text-jade-accent'
          : 'border-border-strong bg-bg-elevated text-text-secondary',
      )}
      aria-live="polite"
      aria-label={`${total} lembrete${total > 1 ? 's' : ''} restante${total > 1 ? 's' : ''}`}
    >
      <Bookmark size={12} strokeWidth={2.4} />
      <AnimatePresence mode="popLayout">
        <motion.span
          key={total}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="tabular-nums"
        >
          {total}
        </motion.span>
      </AnimatePresence>
      <span className="text-text-muted">lembrete{total > 1 ? 's' : ''}</span>
    </motion.span>
  );
}
