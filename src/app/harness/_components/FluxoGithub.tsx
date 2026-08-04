import type { KpisGerais } from '@/lib/harness/kpis';
import { cn } from '@/lib/utils';
import type { PrSemana } from '@/types/harness';
import { Card, PopoverInfo, type Status, corStatus } from './ui';

const fmtLead = (min: number | null): string =>
  min == null ? '—' : min < 90 ? `${Math.round(min)} min` : `${(min / 60).toFixed(1)} h`;

// Bloco 2 — fluxo de entrega via GitHub. SEMANAL FIXO: os dados vêm
// pré-computados por semana no blob, então não seguem o filtro de período.
export function FluxoGithub({ prs, gerais }: { prs: PrSemana[]; gerais: KpisGerais }) {
  // painel.mjs: lista na ordem [s=3, s=2, s=1, s=0] — s=0 é a semana atual.
  const ordenado = [...prs].sort((a, b) => b.s - a.s);
  const semana = ordenado.find((w) => w.s === 0) ?? null;
  const anterior = ordenado.find((w) => w.s === 1) ?? null;

  if (!semana) {
    // Fallback do painel.mjs: medida por tarefa do ledger (despacho→aceite).
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Card>
          <div className="text-xs font-semibold text-text-muted">
            Velocidade
            <PopoverInfo texto="GitHub indisponível — caindo na medida por tarefa do ledger (despacho→aceite), que enche ao longo da semana." />
          </div>
          <div className="my-1 text-2xl font-bold tabular-nums text-text-primary sm:text-[28px]">
            {gerais.durMed != null ? `${gerais.durMed} min` : '—'}
          </div>
          <div className="text-[11.5px] leading-snug text-text-muted">
            {gerais.durN ? `mediana despacho→aceite (n=${gerais.durN})` : 'começando a medir agora'}
          </div>
        </Card>
      </div>
    );
  }

  const dPrs = anterior ? semana.prs - anterior.prs : null;
  const dLead =
    semana.leadMin != null && anterior?.leadMin != null ? semana.leadMin - anterior.leadMin : null;
  const serie = ordenado.map((w) => w.prs).join(' · ');
  const serieLead = ordenado.map((w) => fmtLead(w.leadMin)).join(' · ');

  const tiles: { k: string; v: string; meta: React.ReactNode; st: Status; como: string }[] = [
    {
      k: 'Entregas (PRs)',
      v: `${semana.prs}`,
      meta: (
        <>
          esta semana
          {dPrs != null && (
            <>
              {' · '}
              <span className={dPrs >= 0 ? 'text-success' : 'text-warning'}>
                {dPrs >= 0 ? '▲ +' : '▼ '}
                {dPrs} vs semana passada
              </span>
            </>
          )}
          <br />
          <span className="tabular-nums opacity-85">4 sem: {serie}</span>
        </>
      ),
      st:
        dPrs == null
          ? 'mut'
          : dPrs >= 0
            ? 'good'
            : Math.abs(dPrs) <= 0.15 * (anterior?.prs || 1)
              ? 'acc'
              : 'warn',
      como: 'Quantos PRs (pacotes de mudança) foram mergeados no SeuCamarão em cada semana. É o VOLUME de entrega. Verde = igual ou mais que a semana passada; amarelo = caiu bem. A série mostra as 4 últimas semanas, da mais antiga (esquerda) à atual (direita).',
    },
    {
      k: 'Tempo de merge',
      v: fmtLead(semana.leadMin),
      meta: (
        <>
          abrir→mergear (mediana)
          {dLead != null && (
            <>
              {' · '}
              <span className={dLead <= 0 ? 'text-success' : 'text-warning'}>
                {dLead <= 0
                  ? `▼ ${fmtLead(Math.abs(dLead))} + rápido`
                  : `▲ ${fmtLead(dLead)} + lento`}
              </span>
            </>
          )}
          <br />
          <span className="tabular-nums opacity-85">4 sem: {serieLead}</span>
        </>
      ),
      st: dLead == null ? 'mut' : dLead <= 0 ? 'good' : 'warn',
      como: 'Tempo típico (mediana) entre abrir um PR e mergear. É a AGILIDADE do fluxo. Verde = tão rápido ou mais que a semana passada; amarelo = ficou mais lento. A série mostra as 4 últimas semanas, da mais antiga à atual.',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
        </Card>
      ))}
    </div>
  );
}
