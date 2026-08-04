import { cn } from '@/lib/utils';
import { PopoverInfo } from './PopoverInfo';

export { PopoverInfo };

// Status do painel.mjs → tokens Obsidian/Jade do TinDo
export type Status = 'good' | 'warn' | 'crit' | 'acc' | 'mut';

export function corStatus(st: Status): string {
  switch (st) {
    case 'good':
      return 'text-success';
    case 'warn':
      return 'text-warning';
    case 'crit':
      return 'text-danger';
    case 'acc':
      return 'text-jade-accent';
    case 'mut':
      return 'text-text-primary';
  }
}

export function corPill(st: Status): string {
  switch (st) {
    case 'good':
      return 'bg-success/15 text-success';
    case 'warn':
      return 'bg-warning/15 text-warning';
    case 'crit':
      return 'bg-danger/15 text-danger';
    case 'acc':
      return 'bg-jade/20 text-jade-accent';
    case 'mut':
      return 'bg-bg-surface text-text-muted';
  }
}

export const pc = (x: number | null): string => (x == null ? '—' : `${Math.round(100 * x)}%`);

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-border-strong bg-bg-elevated p-4', className)}>
      {children}
    </div>
  );
}

export function Secao({
  titulo,
  info,
  subtitulo,
  children,
}: {
  titulo: string;
  info?: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-1 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {titulo}
        {info && <PopoverInfo texto={info} />}
        {subtitulo && <span className="ml-2 normal-case tracking-normal">{subtitulo}</span>}
      </h2>
      {children}
    </section>
  );
}
