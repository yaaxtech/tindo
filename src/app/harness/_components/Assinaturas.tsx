import { type VereditoAssinatura, custoAssinaturas, custoMedioTarefa } from '@/lib/harness/kpis';
import { cn } from '@/lib/utils';
import type { Assinatura, LedgerLinha } from '@/types/harness';
import { Card, type Status, corPill, corStatus } from './ui';

const VEREDITO: Record<VereditoAssinatura, { st: Status; txt: (quotas: number) => string }> = {
  aumentar: { st: 'acc', txt: (q) => `saturada (${q}× quota) — candidata a AUMENTAR` },
  cancelar: { st: 'crit', txt: () => 'sem uso no período — candidata a CANCELAR' },
  observar: { st: 'warn', txt: () => 'custo alto por tarefa — observar' },
  manter: { st: 'good', txt: () => 'rende bem — manter' },
};

const fmtBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Bloco 5 — assinaturas: custo por tarefa proporcional ao período + veredito.
export function Assinaturas({
  linhas,
  assinaturas,
  janelaDias,
}: {
  linhas: LedgerLinha[];
  assinaturas: Assinatura[];
  janelaDias: number;
}) {
  const calc = custoAssinaturas(linhas, assinaturas, janelaDias);
  const custoMedio = custoMedioTarefa(linhas, assinaturas, janelaDias);
  const rotuloPeriodo =
    janelaDias === 1 ? 'neste dia' : janelaDias === 7 ? 'nesta semana' : `em ${janelaDias} dias`;

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {calc.map((a) => {
        const ver = VEREDITO[a.veredito];
        const custoTxt = a.custoSub != null ? `$${a.custoSub.toFixed(2)}` : '—';
        const custoSt: Status =
          a.custoSub == null
            ? 'mut'
            : a.custoSub <= (custoMedio || 2) * 1.2
              ? 'good'
              : a.custoSub <= (custoMedio || 2) * 1.6
                ? 'acc'
                : 'warn';
        return (
          <Card key={a.nome} className="flex flex-col">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm font-bold">{a.nome}</div>
              <div className="font-bold tabular-nums">
                ${a.valor}
                <span className="text-[11px] font-normal text-text-muted">/mês</span>
              </div>
            </div>
            <div className="mb-2.5 mt-1 text-xs leading-snug text-text-muted">{a.papel}</div>
            <div className="mb-2 flex items-baseline gap-2">
              <span className={cn('text-[22px] font-bold tabular-nums', corStatus(custoSt))}>
                {custoTxt}
              </span>
              <span className="text-[11px] text-text-muted">
                por tarefa {rotuloPeriodo} · {a.uso} tarefa{a.uso === 1 ? '' : 's'}
              </span>
            </div>
            <span
              className={cn(
                'self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                corPill(ver.st),
              )}
            >
              {ver.txt(a.quotas)}
            </span>
            <div className="mt-2 flex justify-end text-[11px] text-text-muted">
              <span>renova {fmtBR(a.renova)}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
