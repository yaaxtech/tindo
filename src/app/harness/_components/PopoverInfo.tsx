'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

/**
 * Popover "i" de explicação leiga — equivalente acessível ao <details> do
 * painel.mjs. Abre/fecha por clique e fecha ao clicar fora ou apertar Esc.
 */
export function PopoverInfo({ texto, label = 'como é medido' }: { texto: string; label?: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const aoEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoEsc);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoEsc);
    };
  }, [aberto]);

  return (
    <span ref={ref} className="relative ml-1.5 inline-block align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className={cn(
          'inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border font-serif text-[10px] italic',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent/40',
          aberto
            ? 'border-jade-accent bg-jade-accent text-text-inverse'
            : 'border-text-muted text-text-muted',
        )}
      >
        i
      </button>
      {aberto && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-6 z-20 block w-[min(280px,76vw)] -translate-x-1/2 rounded-md border border-border-strong bg-bg-elevated p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-text-primary shadow-elevated"
        >
          {texto}
        </span>
      )}
    </span>
  );
}
