'use client';

import { cn } from '@/lib/utils';

export const JANELAS = [
  { dias: 1, rotulo: 'Dia' },
  { dias: 7, rotulo: 'Semana' },
  { dias: 15, rotulo: '15 dias' },
  { dias: 30, rotulo: 'Mês' },
] as const;

export function FiltroPeriodo({
  janelaDias,
  diasComDados,
  onChange,
}: {
  janelaDias: number;
  diasComDados: number;
  onChange: (dias: number) => void;
}) {
  return (
    <nav aria-label="Período" className="flex flex-wrap items-center gap-1">
      {JANELAS.map(({ dias, rotulo }) => {
        const parcial = dias > diasComDados;
        return (
          <button
            key={dias}
            type="button"
            aria-pressed={janelaDias === dias}
            title={
              parcial ? `Só há ${diasComDados} dias de dados — igual à janela cheia` : undefined
            }
            onClick={() => onChange(dias)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent/40',
              janelaDias === dias
                ? 'border-jade-accent/40 bg-jade/20 text-jade-accent'
                : 'border-border-strong bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              parcial && 'opacity-60',
            )}
          >
            {rotulo}
            <span className="ml-1 text-[10px] text-text-muted">{dias}d</span>
          </button>
        );
      })}
    </nav>
  );
}
