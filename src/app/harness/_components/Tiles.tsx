import { type KpisGerais, custoMedioTarefa } from '@/lib/harness/kpis';
import { cn } from '@/lib/utils';
import type { Assinatura, LedgerLinha } from '@/types/harness';
import { Card, PopoverInfo, type Status, corStatus, pc } from './ui';

interface TileDef {
  k: string;
  v: string;
  meta: string;
  st: Status;
  como: string;
  delta: number | null; // variação vs período anterior, na unidade do valor
  deltaFmt: (d: number) => string;
  melhor: 'up' | 'down';
}

const ppFmt = (d: number) => `${Math.abs(Math.round(d * 100))} pp`;
const usdFmt = (d: number) => `$${Math.abs(d).toFixed(2)}`;

function Delta({
  delta,
  fmt,
  melhor,
}: { delta: number | null; fmt: (d: number) => string; melhor: 'up' | 'down' }) {
  if (delta == null)
    return <span className="text-text-muted">sem período anterior pra comparar</span>;
  if (delta === 0) return <span className="text-text-muted">= igual ao período anterior</span>;
  const subiu = delta > 0;
  const bom = melhor === 'up' ? subiu : !subiu;
  return (
    <span className={bom ? 'text-success' : 'text-warning'}>
      {subiu ? '▲ +' : '▼ −'}
      {fmt(delta)} vs período anterior
    </span>
  );
}

export function Tiles({
  atual,
  anterior,
  linhasAtual,
  assinaturas,
  janelaDias,
}: {
  atual: KpisGerais;
  anterior: KpisGerais;
  linhasAtual: LedgerLinha[];
  assinaturas: Assinatura[];
  janelaDias: number;
}) {
  const totalMes = assinaturas.reduce((s, a) => s + a.valor, 0);
  const custoDesp = custoMedioTarefa(linhasAtual, assinaturas, janelaDias);
  const custoDespAnt = anterior.n
    ? assinaturas.reduce((s, a) => s + (a.valor * janelaDias) / 30, 0) / anterior.n
    : null;

  const diff = (a: number | null, b: number | null): number | null =>
    a == null || b == null ? null : a - b;

  // Economia REAL: as assinaturas são flat — o que muda com o volume é o
  // custo POR despacho entregue. Gasto proporcional à janela.
  const gastoJanela = (totalMes * janelaDias) / 30;
  const rotuloPeriodo =
    janelaDias === 1 ? 'no dia' : janelaDias === 7 ? 'na semana' : `em ${janelaDias} dias`;
  const comoEconomia =
    custoDesp != null
      ? `Some as ${assinaturas.length} assinaturas ($${totalMes}/mês = $${gastoJanela.toFixed(0)} em ${janelaDias} ${janelaDias === 1 ? 'dia' : 'dias'}) e divida pelas ${atual.n} tarefas entregues ${rotuloPeriodo}. Dá o custo médio de cada tarefa. Como as assinaturas são de valor fixo, quanto MAIS tarefas o harness entrega, MENOR fica este número — é a medida de aproveitar o que já se paga.`
      : 'Custo médio por tarefa entregue, somando as assinaturas.';

  const tiles: TileDef[] = [
    {
      k: 'Qualidade',
      v: pc(atual.ok1),
      meta: 'certo de primeira · meta ≥80%',
      st:
        atual.ok1 == null ? 'mut' : atual.ok1 >= 0.8 ? 'good' : atual.ok1 >= 0.7 ? 'warn' : 'crit',
      como: 'De cada 100 tarefas despachadas, quantas foram aceitas na 1ª revisão, sem precisar de correção. Tarefas barradas por quota não entram na conta (não julgam a qualidade do modelo). Meta: 80% ou mais.',
      delta: diff(atual.ok1, anterior.ok1),
      deltaFmt: ppFmt,
      melhor: 'up',
    },
    {
      k: 'Economia',
      v: custoDesp != null ? `$${custoDesp.toFixed(2)}` : '—',
      meta: `por tarefa entregue · fora do Claude ${pc(atual.offload)}`,
      st: custoDesp == null ? 'mut' : custoDesp <= 2.5 ? 'good' : custoDesp <= 5 ? 'acc' : 'warn',
      como: comoEconomia,
      delta: diff(custoDesp, custoDespAnt),
      deltaFmt: usdFmt,
      melhor: 'down',
    },
    {
      k: 'Quota',
      v: pc(atual.quotaHit),
      meta: 'despachos barrados por limite · ideal baixo, >0',
      st:
        atual.quotaHit == null
          ? 'mut'
          : atual.quotaHit > 0.15
            ? 'warn'
            : atual.quotaHit > 0
              ? 'good'
              : 'mut',
      como: '% de despachos que bateram no limite da assinatura e tiveram que ir para outra frente. 0% o tempo todo = assinatura sobrando (dinheiro parado); alto = frente saturada. O saudável é baixo, mas maior que zero.',
      delta: diff(atual.quotaHit, anterior.quotaHit),
      deltaFmt: ppFmt,
      melhor: 'down',
    },
    {
      k: 'Retrabalho',
      v: pc(atual.reciclo),
      meta: 'precisou de rodada extra · meta ≤20%',
      st:
        atual.reciclo == null
          ? 'mut'
          : atual.reciclo <= 0.2
            ? 'good'
            : atual.reciclo <= 0.35
              ? 'warn'
              : 'crit',
      como: '% de tarefas que precisaram de uma rodada extra: correção, escalada para modelo mais forte, ou refeitas. Cada rodada extra custa um ciclo inteiro de despacho + revisão. Meta: 20% ou menos.',
      delta: diff(atual.reciclo, anterior.reciclo),
      deltaFmt: ppFmt,
      melhor: 'down',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.k}>
          <div className="text-xs font-semibold text-text-muted">
            {t.k}
            <PopoverInfo texto={t.como} />
          </div>
          <div
            className={cn('my-1 text-2xl font-bold tabular-nums sm:text-[28px]', corStatus(t.st))}
          >
            {t.v}
          </div>
          <div className="text-[11.5px] leading-snug text-text-muted">{t.meta}</div>
          <div className="mt-1 text-[11px] leading-snug">
            <Delta delta={t.delta} fmt={t.deltaFmt} melhor={t.melhor} />
          </div>
        </Card>
      ))}
    </div>
  );
}
