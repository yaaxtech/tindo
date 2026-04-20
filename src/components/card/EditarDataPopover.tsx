'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

interface EditarDataPopoverProps {
  aberto: boolean;
  label: string;
  valorInicial: string | null;
  onFechar: () => void;
  onSalvar: (ate: string | null) => void;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function amanhaISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function semanaQueVemISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function EditarDataPopover({
  aberto,
  label,
  valorInicial,
  onFechar,
  onSalvar,
}: EditarDataPopoverProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus no input quando abre
  useEffect(() => {
    if (aberto) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [aberto]);

  // Fecha com ESC
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onFechar();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [aberto, onFechar]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onFechar();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const handleSalvar = (): void => {
    const val = inputRef.current?.value ?? null;
    onSalvar(val || null);
  };

  const handleRapido = (iso: string): void => {
    onSalvar(iso);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="popover-label"
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
    >
      <div
        ref={containerRef}
        className={cn(
          'pointer-events-auto grad-card w-72 rounded-xl border border-jade-accent/60 p-4 shadow-2xl',
          // fade-in via CSS transform — GPU only
          'animate-[fadeInScale_180ms_ease-out_forwards]',
        )}
        style={{ willChange: 'transform, opacity' }}
      >
        <h3 id="popover-label" className="mb-3 text-sm font-semibold text-text-primary">
          {label}
        </h3>

        {/* Input date */}
        <input
          ref={inputRef}
          type="date"
          defaultValue={valorInicial ?? ''}
          className={cn(
            'w-full rounded-md border border-border-strong bg-bg-surface px-3 py-2',
            'text-sm text-text-primary focus:border-jade-accent focus:outline-none',
            '[color-scheme:dark]',
          )}
        />

        {/* Atalhos rápidos */}
        <div className="mt-3 flex gap-2">
          {[
            { label: 'Hoje', iso: hojeISO() },
            { label: 'Amanhã', iso: amanhaISO() },
            { label: 'Semana', iso: semanaQueVemISO() },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleRapido(item.iso)}
              className={cn(
                'flex-1 rounded-md border border-border-strong bg-bg-surface py-1.5 text-xs',
                'text-text-secondary transition-colors hover:border-jade-accent/50 hover:text-jade-accent',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Ações */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onSalvar(null)}
            className={cn(
              'rounded-md border border-border-strong bg-bg-surface px-3 py-2 text-xs',
              'text-text-muted transition-colors hover:text-text-secondary',
            )}
          >
            Limpar
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onFechar}
            className={cn(
              'rounded-md px-3 py-2 text-xs text-text-secondary',
              'transition-colors hover:text-text-primary',
            )}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            className={cn(
              'rounded-md grad-jade px-4 py-2 text-xs font-semibold text-text-inverse',
              'transition-opacity hover:opacity-90 active:opacity-80',
            )}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
