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

/** Segundos em unidade legível (s → min → h). Usado pelos blocos do GitHub. */
export function formatarSegundos(segundos: number | null): string {
  if (segundos == null || !Number.isFinite(segundos) || segundos < 0) return '—';
  if (segundos < 90) return `${Math.round(segundos)} s`;
  if (segundos < 90 * 60) return `${Math.round(segundos / 60)} min`;
  return `${(segundos / 3600).toFixed(1)} h`;
}

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
  escopo,
  id,
  children,
}: {
  titulo: string;
  info?: string;
  subtitulo?: string;
  escopo?: { tipo: 'filtro'; dias: number } | { tipo: 'fixo'; rotulo: string };
  /** Âncora da NavPainel. O scroll-mt vem da CSS var --harness-nav-topo,
   * medida em runtime pela nav (header + nav + respiro); o fallback 8rem
   * cobre a 1ª pintura antes da medição. */
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={id ? 'scroll-mt-[var(--harness-nav-topo,8rem)]' : undefined}>
      <h2 className="mb-3 flex items-baseline gap-1 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {titulo}
        {info && <PopoverInfo texto={info} />}
        {subtitulo && <span className="ml-2 normal-case tracking-normal">{subtitulo}</span>}
        {escopo && (
          <span
            className={cn(
              'ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal',
              escopo.tipo === 'filtro'
                ? 'bg-jade/15 text-jade-accent'
                : 'bg-bg-surface text-text-muted',
            )}
          >
            {escopo.tipo === 'filtro' ? `filtro · ${escopo.dias}d` : escopo.rotulo}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}
