import type { KpiHistoricoLinha, VolumeRepo } from '@/types/harness';
import { Card, pc } from './ui';

const nBR = (x: number) => x.toLocaleString('pt-BR');

// Bloco 6a — volume de código (4 semanas, pré-computado no blob). Fixo.
export function VolumeCodigo({ volume }: { volume: VolumeRepo[] }) {
  const maxLoc = Math.max(1, ...volume.flatMap((r) => r.semanas.map((s) => s.add + s.del)));
  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
      {volume.map((r) => {
        const tot = r.semanas.reduce((s, w) => s + w.add + w.del, 0);
        return (
          <Card key={r.nome}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <b>{r.nome}</b>
              <span className="text-xs tabular-nums text-text-muted">
                {nBR(tot)} linhas em 4 semanas
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {[...r.semanas]
                .sort((a, b) => a.s - b.s)
                .map((s) => (
                  <div key={s.s} className="grid grid-cols-[92px_1fr_auto] items-center gap-2.5">
                    <span className="text-[11.5px] text-text-muted">
                      {s.s === 0 ? 'Esta semana' : `${s.s} semana${s.s === 1 ? '' : 's'} atrás`}
                    </span>
                    <span className="flex h-3 overflow-hidden rounded-sm bg-bg-surface">
                      <span
                        className="block h-full bg-success"
                        style={{ width: `${Math.round((100 * s.add) / maxLoc)}%` }}
                      />
                      <span
                        className="block h-full bg-danger"
                        style={{ width: `${Math.round((100 * s.del) / maxLoc)}%` }}
                      />
                    </span>
                    <span className="whitespace-nowrap text-xs tabular-nums">
                      <b className="text-success">+{nBR(s.add)}</b>{' '}
                      <span className="text-danger">−{nBR(s.del)}</span>
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// Bloco 6b — histórico dos snapshots (fixo, últimos 10).
export function Historico({
  history,
  totalMes,
}: {
  history: KpiHistoricoLinha[];
  totalMes: number;
}) {
  const linhas = history.slice(-10).reverse();
  return (
    <div className="overflow-x-auto rounded-xl border border-border-strong bg-bg-elevated">
      <table className="w-full border-collapse text-[12.5px] tabular-nums">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted">
            {[
              'Data',
              'Janela',
              'N',
              'Qualidade',
              '$/tarefa',
              'Fora Claude',
              'Quota',
              'Retrabalho',
              'Veloc.',
              'Nota',
            ].map((h) => (
              <th
                key={h}
                className="border-b border-border px-3 py-2 font-semibold whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-2 text-text-muted">
                sem snapshots ainda
              </td>
            </tr>
          )}
          {linhas.map((h) => {
            const custo = h.n ? (totalMes * (h.janela_dias / 30)) / h.n : null;
            return (
              <tr key={`${h.ts}-${h.janela_dias}`} className="last:[&>td]:border-b-0">
                <td className="whitespace-nowrap border-b border-border px-3 py-2">
                  {h.ts.slice(8, 10)}/{h.ts.slice(5, 7)}
                </td>
                <td className="whitespace-nowrap border-b border-border px-3 py-2">
                  {h.janela_dias}d
                </td>
                <td className="whitespace-nowrap border-b border-border px-3 py-2">{h.n}</td>
                <td className="whitespace-nowrap border-b border-border px-3 py-2">
                  {pc(h.ok1_pct)}
                </td>
                <td className="whitespace-nowrap border-b border-border px-3 py-2">
                  {custo != null ? `$${custo.toFixed(2)}` : '—'}
                </td>
                <td className="whitespace-nowrap border-b border-border px-3 py-2">
                  {pc(h.offload_pct)}
                </td>
                <td className="whitespace-nowrap border-b border-border px-3 py-2">
                  {pc(h.quota_hit_pct)}
                </td>
                <td className="whitespace-nowrap border-b border-border px-3 py-2">
                  {pc(h.reciclo_pct)}
                </td>
                <td className="whitespace-nowrap border-b border-border px-3 py-2">
                  {h.dur_mediana_min != null ? `${h.dur_mediana_min}m` : '—'}
                </td>
                <td className="max-w-[260px] truncate whitespace-nowrap border-b border-border px-3 py-2 text-text-muted">
                  {h.nota || ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
