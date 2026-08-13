import { type PercentualComAmostra, calcularActionsKpis } from '@/lib/harness/actions';
import type { ActionsSnapshot } from '@/types/harness';
import { Card, Secao, formatarSegundos } from './ui';

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dinheiro = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function minutos(valor: number | null): string {
  return valor == null ? '—' : `${numero.format(Math.round(valor))} min`;
}

function percentual(amostra: PercentualComAmostra): string {
  return amostra.valor == null ? '—' : `${Math.round(amostra.valor * 100)}%`;
}

function Amostra({ valor, unidade = 'min' }: { valor: PercentualComAmostra; unidade?: string }) {
  return (
    <span className="tabular-nums">
      amostra {numero.format(Math.round(valor.x))}/{numero.format(Math.round(valor.y))} {unidade}
    </span>
  );
}

function Kpi({
  titulo,
  valor,
  detalhe,
}: { titulo: string; valor: string; detalhe: React.ReactNode }) {
  return (
    <Card>
      <div className="text-xs font-semibold text-text-muted">{titulo}</div>
      <div className="my-1 text-2xl font-bold tabular-nums text-jade-accent sm:text-[28px]">
        {valor}
      </div>
      <div className="text-[11.5px] leading-snug text-text-muted">{detalhe}</div>
    </Card>
  );
}

export function MinutosGithub({
  snapshot,
  id,
}: {
  snapshot: ActionsSnapshot | null | undefined;
  id?: string;
}) {
  const kpis = snapshot ? calcularActionsKpis(snapshot.dados) : null;

  return (
    <Secao
      id={id}
      titulo="Minutos do GitHub"
      info="Compara o que o GitHub cobraria na nuvem com a espera do Mac e mostra onde reduzir consumo."
      escopo={{ tipo: 'fixo', rotulo: 'ciclo atual' }}
    >
      {snapshot === undefined && (
        <Card>
          <p className="text-sm font-semibold text-text-primary">Carregando minutos do GitHub…</p>
        </Card>
      )}

      {snapshot === null && (
        <Card className="text-center">
          <p className="text-sm font-semibold text-text-primary">A coleta ainda não rodou</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-text-muted">
            A máquina local vai medir os jobs do GitHub e este bloco aparecerá no próximo empurrão.
          </p>
        </Card>
      )}

      {snapshot && kpis && (
        <div className="space-y-2.5">
          <Card className="border-jade/40 bg-jade/10">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-jade-accent">
              Veredito
            </div>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-text-primary">
              {kpis.veredito}
            </p>
          </Card>

          {snapshot.dados.parcial && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Coleta parcial: {snapshot.dados.parcial}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Kpi
              titulo="1. Cota do ciclo"
              valor={minutos(kpis.minutosCiclo)}
              detalhe={
                <>
                  {percentual(kpis.pctCota)} da cota · <Amostra valor={kpis.pctCota} />
                  <br />
                  projeção {minutos(kpis.projecaoMes)} · estouro{' '}
                  {kpis.custoEstouroUsd == null ? '—' : dinheiro.format(kpis.custoEstouroUsd)}
                </>
              }
            />
            <Kpi
              titulo="2. Se ligasse a nuvem"
              valor={minutos(kpis.projecaoEquivalente)}
              detalhe={
                <>
                  uso até agora {minutos(kpis.equivalenteNuvem)} · projeção mensal
                  <br />
                  custaria{' '}
                  {kpis.custoSeLigarUsd == null ? '—' : dinheiro.format(kpis.custoSeLigarUsd)} no mês
                </>
              }
            />
            <Kpi
              titulo="3. Fila antes de começar"
              valor={formatarSegundos(kpis.filaP50)}
              detalhe={`p90 ${formatarSegundos(kpis.filaP90)} · amostra ${kpis.filaN} jobs`}
            />
            <Kpi
              titulo="4. Preço da hora economizada"
              valor={
                kpis.usdPorHoraEconomizada == null
                  ? '—'
                  : dinheiro.format(kpis.usdPorHoraEconomizada)
              }
              detalhe="custo de mandar tudo para a nuvem ÷ horas de fila que isso eliminaria"
            />
            <Kpi
              titulo="5. Minutos por PR mergeado"
              valor={minutos(kpis.minPorPrMergeado)}
              detalhe={`amostra ${snapshot.dados.prs_mergeados_ciclo} PRs mergeados no ciclo`}
            />
            <Kpi
              titulo="6. Concentração por branch"
              valor={percentual(kpis.concentracaoBranch.pctMaior)}
              detalhe={
                <>
                  <Amostra valor={kpis.concentracaoBranch.pctMaior} /> · maior branch
                  <br />
                  {kpis.concentracaoBranch.top5.length
                    ? kpis.concentracaoBranch.top5
                        .map((branch) => `${branch.branch} (${numero.format(branch.min_total)})`)
                        .join(' · ')
                    : '—'}
                </>
              }
            />
            <Kpi
              titulo="7. Desperdício"
              valor={percentual(kpis.desperdicioPct)}
              detalhe={
                <>
                  falha/cancelamento · <Amostra valor={kpis.desperdicioPct} />
                  <br />
                  sem PR {percentual(kpis.branchSemPrPct)} · <Amostra valor={kpis.branchSemPrPct} />
                </>
              }
            />
            <Kpi
              titulo="8. Etapa dominante"
              valor={kpis.stepDominante?.nome ?? '—'}
              detalhe={
                kpis.stepDominante ? (
                  <>
                    {percentual(kpis.stepDominante.pct)} do tempo ·{' '}
                    <Amostra valor={kpis.stepDominante.pct} unidade="s" />
                  </>
                ) : (
                  '—'
                )
              }
            />
            <Kpi
              titulo="9. Hora de pico"
              valor={kpis.horaPico ? `${String(kpis.horaPico.hora).padStart(2, '0')}h UTC` : '—'}
              detalhe={
                kpis.horaPico
                  ? `fila p50 ${formatarSegundos(kpis.horaPico.p50)} · p90 ${formatarSegundos(kpis.horaPico.p90)} · amostra ${kpis.horaPico.n} jobs`
                  : '—'
              }
            />
          </div>

          <p className="text-xs leading-relaxed text-text-muted">
            Destino atual: CI {snapshot.dados.destino.RUNNER_CI ?? '—'} · leve{' '}
            {snapshot.dados.destino.RUNNER_LEVE ?? '—'}.
          </p>
        </div>
      )}
    </Secao>
  );
}
