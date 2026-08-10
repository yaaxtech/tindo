import { type TerrenoKpi, kpisTerreno } from '@/lib/harness/kpis';
import { cn } from '@/lib/utils';
import type { CadeiaTerreno, LedgerLinha } from '@/types/harness';
import { Card, PopoverInfo, type Status, corPill, pc } from './ui';

const SINAL: Record<TerrenoKpi['sinal']['tipo'], { st: Status; ico: string; label: string }> = {
  ok: { st: 'acc', ico: '✓', label: 'manter' },
  subir: { st: 'crit', ico: '▲', label: 'subir modelo' },
  baratear: { st: 'good', ico: '▼', label: 'pode baratear' },
  quota: { st: 'warn', ico: '‖', label: 'saturada' },
  dados: { st: 'mut', ico: '…', label: 'pouco dado' },
};

const COMO_TERRENO =
  'O primeiro da fila é o titular; os seguintes assumem quando ele bate quota ou falha. ' +
  'Números no período: despachos = tarefas enviadas · ok de 1ª = aceitas sem correção · ' +
  'retrabalho = precisaram de rodada extra · quota = barradas por limite. ' +
  'Sinal automático: ok de 1ª <70% com 5+ tarefas → subir modelo · ≥90% com 8+ → testar mais barato · quota 3× → saturada.';

export function Terrenos({
  linhas,
  cadeias,
}: {
  linhas: LedgerLinha[];
  cadeias: Record<string, CadeiaTerreno>;
}) {
  const por = kpisTerreno(linhas, cadeias);
  return (
    <div className="flex flex-col gap-2.5">
      {Object.entries(cadeias).map(([key, c]) => {
        const t = por[key];
        const s = SINAL[t?.sinal.tipo ?? 'dados'];
        return (
          <Card key={key} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-bold">
                {c.rotulo}
                <PopoverInfo texto={COMO_TERRENO} />
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
                  corPill(s.st),
                )}
              >
                <span className="text-[10px]">{s.ico}</span>
                {s.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
              {[c.default, ...c.fallback].map((m, i) => (
                <span key={m} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-[11px] text-text-muted">→</span>}
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5',
                      i === 0
                        ? 'bg-jade/20 font-semibold text-jade-accent'
                        : 'bg-bg-surface text-text-muted',
                    )}
                  >
                    {m}
                  </span>
                </span>
              ))}
              {c.nunca_externo && (
                <span className="ml-1 text-[11px] text-danger">nunca sai do Claude</span>
              )}
            </div>
            <div className="text-xs leading-relaxed text-text-muted">
              ✍ escreve o titular · ✔ revisa: {c.revisor}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] tabular-nums text-text-muted">
              <span>
                <b className="text-text-primary">{t?.n ?? 0}</b> despachos
              </span>
              <span>
                ok de 1ª <b className="text-text-primary">{pc(t?.ok1Pct ?? null)}</b>
                {t && t.julgaveis > 0 && ` · ${t.ok1}/${t.julgaveis}`}
              </span>
              <span>
                retrabalho <b className="text-text-primary">{pc(t?.recicloPct ?? null)}</b>
                {t && t.julgaveis > 0 && ` · ${t.reciclo}/${t.julgaveis}`}
              </span>
              <span>
                quota <b className="text-text-primary">{t?.quota ?? 0}</b>
              </span>
            </div>
            <div className="text-[12.5px] text-text-muted">{t?.sinal.texto ?? 'sem despachos'}</div>
          </Card>
        );
      })}
    </div>
  );
}
