import { porModelo } from '@/lib/harness/kpis';
import type { LedgerLinha } from '@/types/harness';
import { Card, pc } from './ui';

const FRENTE_LBL: Record<string, string> = {
  codex: 'Codex',
  kimi: 'Kimi',
  claude: 'Claude',
  cerebro: 'Cérebro',
};

// Bloco 4 — chamadas por modelo+effort no período do filtro (barras).
export function Modelos({ linhas }: { linhas: LedgerLinha[] }) {
  const modelos = porModelo(linhas);
  const max = Math.max(1, ...modelos.map((m) => m.n));

  if (!modelos.length) {
    return (
      <Card>
        <span className="text-[13px] text-text-muted">sem chamadas no período</span>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2">
      {modelos.map((m) => (
        <div
          key={m.nome}
          className="grid grid-cols-[minmax(120px,1.4fr)_1fr_42px_86px] items-center gap-3"
        >
          <span className="truncate text-[13px] font-semibold tabular-nums">
            {m.nome}
            <span className="ml-1.5 rounded bg-bg-surface px-1.5 py-0.5 text-[10.5px] font-normal text-text-muted">
              {FRENTE_LBL[m.frente] || m.frente}
            </span>
          </span>
          <span className="h-2 overflow-hidden rounded bg-bg-surface">
            <span
              className="block h-full rounded bg-jade-accent"
              style={{ width: `${Math.round((100 * m.n) / max)}%` }}
            />
          </span>
          <span className="text-right text-sm tabular-nums">
            <b>{m.n}</b>×
          </span>
          <span className="text-right text-[11.5px] tabular-nums text-text-muted">
            {m.julg ? `ok ${pc(m.ok1 / m.julg)} · ${m.ok1}/${m.julg}` : '—'}
          </span>
        </div>
      ))}
    </Card>
  );
}
