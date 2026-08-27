import { type KpisGerais, MIN_AMOSTRA_GERAL, custoMedioTarefa } from '@/lib/harness/kpis';
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
  const custoDespAnt = anterior.aceitas
    ? assinaturas.reduce((s, a) => s + (a.valor * janelaDias) / 30, 0) / anterior.aceitas
    : null;

  const diff = (a: number | null, b: number | null): number | null =>
    a == null || b == null ? null : a - b;
  const qualidadeConfiavel = atual.julg >= MIN_AMOSTRA_GERAL;
  const comparacaoQualidadeConfiavel = qualidadeConfiavel && anterior.julg >= MIN_AMOSTRA_GERAL;

  // Economia REAL: as assinaturas são flat — o que muda com o volume é o
  // custo POR tarefa ACEITA (ok1 + retrabalho). Gasto proporcional à janela.
  const gastoJanela = (totalMes * janelaDias) / 30;
  const rotuloPeriodo =
    janelaDias === 1 ? 'no dia' : janelaDias === 7 ? 'na semana' : `em ${janelaDias} dias`;
  const comoEconomia =
    custoDesp != null
      ? `Some as ${assinaturas.length} assinaturas ($${totalMes}/mês = $${gastoJanela.toFixed(0)} em ${janelaDias} ${janelaDias === 1 ? 'dia' : 'dias'}) e divida pelas ${atual.aceitas} tarefas ACEITAS ${rotuloPeriodo} (concluídas de 1ª ou após retrabalho — quota, escalada e falha não entregaram nada e ficam fora da divisão). Como as assinaturas são de valor fixo, quanto MAIS tarefas o harness entrega, MENOR fica este número — é a medida de aproveitar o que já se paga.`
      : 'Custo médio por tarefa aceita (ok de 1ª + retrabalho), somando as assinaturas.';

  const tiles: TileDef[] = [
    {
      k: 'Qualidade',
      v: pc(atual.ok1),
      meta: qualidadeConfiavel
        ? `certo de primeira · ${atual.ok1N}/${atual.julg} · meta ≥80%`
        : `provisório · ${atual.ok1N}/${atual.julg} · precisa de ${MIN_AMOSTRA_GERAL}`,
      st:
        atual.ok1 == null || !qualidadeConfiavel
          ? 'mut'
          : atual.ok1 >= 0.8
            ? 'good'
            : atual.ok1 >= 0.7
              ? 'warn'
              : 'crit',
      como: `De cada 100 construções com papel carimbado no despacho, quantas foram aceitas na 1ª revisão, sem correção. Revisões, papéis deduzidos, quota, infra e descarte ficam fora. Com menos de ${MIN_AMOSTRA_GERAL} construções julgáveis, a porcentagem aparece como provisória e não dispara alerta. Meta: 80% ou mais.`,
      delta: comparacaoQualidadeConfiavel ? diff(atual.ok1, anterior.ok1) : null,
      deltaFmt: ppFmt,
      melhor: 'up',
    },
    {
      k: 'Economia',
      v: custoDesp != null ? `$${custoDesp.toFixed(2)}` : '—',
      meta: `por tarefa aceita (${atual.aceitas}) · fora do Claude ${pc(atual.offload)} (${atual.offN}/${atual.n})`,
      st: custoDesp == null ? 'mut' : custoDesp <= 2.5 ? 'good' : custoDesp <= 5 ? 'acc' : 'warn',
      como: comoEconomia,
      delta: diff(custoDesp, custoDespAnt),
      deltaFmt: usdFmt,
      melhor: 'down',
    },
    {
      k: 'Quota',
      v: pc(atual.quotaHit),
      meta: `barrados por limite · ${atual.quotaN}/${atual.n} · ideal baixo, >0`,
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
      meta: qualidadeConfiavel
        ? `rodada extra · ${atual.recN}/${atual.julg} · meta ≤20%`
        : `provisório · ${atual.recN}/${atual.julg} · precisa de ${MIN_AMOSTRA_GERAL}`,
      st:
        atual.reciclo == null || !qualidadeConfiavel
          ? 'mut'
          : atual.reciclo <= 0.2
            ? 'good'
            : atual.reciclo <= 0.35
              ? 'warn'
              : 'crit',
      como: `Percentual das construções carimbadas que precisaram de correção, escalada ou nova rodada. Revisões ficam numa métrica própria; papéis deduzidos, quota, infra e descarte não entram. Com menos de ${MIN_AMOSTRA_GERAL} construções julgáveis, o número é provisório. Meta: 20% ou menos.`,
      delta: comparacaoQualidadeConfiavel ? diff(atual.reciclo, anterior.reciclo) : null,
      deltaFmt: ppFmt,
      melhor: 'down',
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
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
      {atual.durN > 0 && (
        <Card className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-xs font-semibold text-text-muted">
            Tempo despacho→aceite
            <PopoverInfo texto="Quanto tempo passa entre despachar uma tarefa e ela ser aceita na revisão. p50 = metade das tarefas fechou nesse tempo ou menos; p90 = 9 em cada 10 fecharam nesse tempo ou menos. Só entram tarefas com duração registrada no ledger (--dur) — o n mostra quantas são, do total julgável do período." />
          </span>
          <span className="text-lg font-bold tabular-nums">
            p50 {atual.durMed} min
            <span className="mx-2 font-normal text-text-muted">·</span>
            p90 {atual.durP90} min
          </span>
          <span className="text-[11.5px] tabular-nums text-text-muted">
            n={atual.durN} de {atual.julg} com duração registrada
          </span>
        </Card>
      )}
    </div>
  );
}
