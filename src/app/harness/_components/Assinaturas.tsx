import { type VereditoAssinatura, custoAssinaturas, custoMedioTarefa } from '@/lib/harness/kpis';
import { cn } from '@/lib/utils';
import type { Assinatura, LedgerLinha } from '@/types/harness';
import { Card, type Status, corPill, corStatus } from './ui';

// A etiqueta descreve o período; a decisão (cancelar, manter, ampliar) é do
// dono na renovação. Os nomes das chaves vêm de kpis.ts e a fórmula não mudou.
const VEREDITO: Record<VereditoAssinatura, { st: Status; txt: (quotas: number) => string }> = {
  aumentar: { st: 'acc', txt: (q) => `saturada — ${q}× barrada por quota nos registros` },
  cancelar: { st: 'crit', txt: () => 'nenhum despacho registrado no período' },
  observar: { st: 'warn', txt: () => 'custo alto por tarefa — observar' },
  manter: { st: 'good', txt: () => 'rende bem' },
};

/**
 * Data de renovação como vem do snapshot: ISO vira dd/mm; vazio vira
 * "não informada"; qualquer outro texto passa como está (#84: nunca inventar
 * data). O gerador é quem sabe a renovação — o painel só mostra.
 */
export function rotuloRenovacao(renova: string | null | undefined): string {
  const valor = (renova ?? '').trim();
  if (!valor) return 'renovação não informada';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return `renova ${valor.slice(8, 10)}/${valor.slice(5, 7)}`;
  return `renova ${valor}`;
}

// Assinaturas: valor de REFERÊNCIA do plano (snapshot, não fatura) e custo
// rateado ESTIMADO por tarefa no período + etiqueta do período. O painel não
// lê saldo nem uso do plano — só os registros do ledger.
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
        const custoTxt = a.custoSub != null ? `$${a.custoSub.toFixed(2)}` : 'uso não medido';
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
                <span className="text-[11px] font-normal text-text-muted">/mês de referência</span>
              </div>
            </div>
            <div className="mb-2.5 mt-1 text-xs leading-snug text-text-muted">{a.papel}</div>
            <div className="mb-2 flex items-baseline gap-2">
              <span
                className={cn(
                  'font-bold tabular-nums',
                  a.custoSub != null ? 'text-[22px]' : 'text-sm',
                  corStatus(custoSt),
                )}
              >
                {custoTxt}
              </span>
              <span className="text-[11px] text-text-muted">
                {a.custoSub != null
                  ? `rateio estimado por tarefa aceita ${rotuloPeriodo} · ${a.aceitas} aceita${a.aceitas === 1 ? '' : 's'} de ${a.uso} despacho${a.uso === 1 ? '' : 's'}`
                  : `uso do plano não medido ${rotuloPeriodo} · sem tarefa aceita nos registros`}
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
              <span>{rotuloRenovacao(a.renova)}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
