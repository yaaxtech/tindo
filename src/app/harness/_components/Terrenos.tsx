import { type TerrenoKpi, kpisTerreno } from '@/lib/harness/kpis';
import { cn } from '@/lib/utils';
import type { CadeiaTerreno, CadeiasPorFrente, FrenteRota, LedgerLinha } from '@/types/harness';
import { useState } from 'react';
import { Card, PopoverInfo, type Status, corPill, pc } from './ui';

const FRENTE_LBL: Record<FrenteRota, string> = {
  claude: 'Claude',
  codex: 'Codex',
};

const SINAL: Record<TerrenoKpi['sinal']['tipo'], { st: Status; ico: string; label: string }> = {
  ok: { st: 'acc', ico: '✓', label: 'manter' },
  subir: { st: 'crit', ico: '▲', label: 'subir modelo' },
  // modelo já no teto (SQL/dinheiro em Opus 5): não há modelo pra cima, a
  // alavanca que sobra é o esforço (high→max) ou reforçar a revisão.
  esforco: { st: 'crit', ico: '▲', label: 'subir esforço' },
  baratear: { st: 'good', ico: '▼', label: 'pode baratear' },
  quota: { st: 'warn', ico: '‖', label: 'saturada' },
  // Três motivos DIFERENTES de não haver ▲/▼ — a pill precisa separá-los, senão
  // "ninguém despachou nesse terreno" e "o registro está furado" viram a mesma
  // coisa na tela e o dono lê instrumento quebrado onde só falta tarefa.
  vazio: { st: 'mut', ico: '∅', label: 'sem dados' },
  dados: { st: 'mut', ico: '…', label: 'pouco dado' },
  ambiguo: { st: 'mut', ico: '?', label: 'registro incompleto' },
};

const COMO_TERRENO =
  'O primeiro da fila é o titular; os seguintes assumem quando ele bate quota ou falha. ' +
  'Números no período: despachos = tarefas enviadas · ok de 1ª = aceitas sem correção · ' +
  'retrabalho = precisaram de rodada extra · quota = barradas por limite. ' +
  'Sinal automático: ok de 1ª <70% com 20+ tarefas → subir modelo · ≥90% com 20+ → testar mais barato · quota 3× → saturada. ' +
  'Quando o modelo já está no teto do terreno (ex.: SQL/dinheiro em Opus 5), não há modelo pra cima: o sinal vira “subir esforço” (high→max) e, esgotado esse, “reforçar a revisão”. ' +
  'A linha “esforço” em cada terreno mostra o degrau atual e até onde o motor pode subir. ' +
  'Quando mais de 30% das tarefas de um modelo entraram sem o terreno declarado, o número mede o registro e não o modelo: ' +
  'a recomendação de trocar o modelo fica suspensa até a amostra melhorar. ' +
  'Sem recomendação, o motivo aparece na etiqueta: “sem dados” = ninguém despachou nesse terreno no período · ' +
  '“pouco dado” = tem despacho, mas menos de 20 tarefas medíveis · ' +
  '“registro incompleto” = tarefa é o que não falta, mas a maioria entrou sem o terreno declarado.';

export function Terrenos({
  linhas,
  linhasGeral,
  cadeias,
  cadeiasPorFrente,
  frenteSelecionada,
  onFrenteChange,
}: {
  /** Linhas do período selecionado; a frente é filtrada abaixo. */
  linhas: LedgerLinha[];
  /** Linhas da frente em todos os períodos publicados, para contextualizar janela vazia. */
  linhasGeral?: LedgerLinha[];
  /** Configuração legada, preservada enquanto o publicador não enviar rotas separadas. */
  cadeias: Record<string, CadeiaTerreno>;
  cadeiasPorFrente?: CadeiasPorFrente;
  frenteSelecionada?: FrenteRota;
  onFrenteChange?: (frente: FrenteRota) => void;
}) {
  const [frenteLocal, setFrenteLocal] = useState<FrenteRota>('claude');
  const frente = frenteSelecionada ?? frenteLocal;
  const chains = cadeiasPorFrente?.[frente] ?? cadeias;
  const rotaPublicada = cadeiasPorFrente?.[frente] != null;
  const linhasDaFrente = linhas.filter((linha) => linha.frente === frente);
  const linhasGeraisDaFrente = (linhasGeral ?? linhas).filter((linha) => linha.frente === frente);
  const por = kpisTerreno(linhasDaFrente, chains);

  const trocarFrente = (novaFrente: FrenteRota) => {
    setFrenteLocal(novaFrente);
    onFrenteChange?.(novaFrente);
  };

  const nomeFrente = FRENTE_LBL[frente];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-secondary">Frente da rota</span>
        <div
          className="inline-flex rounded-full border border-border-strong bg-bg-surface p-0.5"
          role="tablist"
          aria-label="Frente da rota"
        >
          {(Object.keys(FRENTE_LBL) as FrenteRota[]).map((opcao) => (
            <button
              key={opcao}
              type="button"
              role="tab"
              aria-selected={frente === opcao}
              onClick={() => trocarFrente(opcao)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                frente === opcao
                  ? 'bg-jade/20 text-jade-accent'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {FRENTE_LBL[opcao]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-text-muted">
        {rotaPublicada
          ? `Rota ${nomeFrente} publicada separadamente no snapshot. Os números abaixo usam somente despachos desta frente.`
          : `Rota ${nomeFrente} específica ainda não foi publicada; a configuração legada é mostrada como referência. Os números abaixo usam somente despachos desta frente.`}
      </p>

      {Object.entries(chains).map(([key, c]) => {
        const t = por[key];
        const s = SINAL[t?.sinal.tipo ?? 'vazio'];
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
              <span className="flex items-center gap-1.5">
                <span className="text-[11px] text-text-secondary">Titular</span>
                <span className="rounded-md bg-jade/20 px-2 py-0.5 font-semibold text-jade-accent">
                  {c.default}
                </span>
              </span>
              {c.fallback.map((m, i) => (
                <span key={m} className="flex items-center gap-1.5">
                  <span className="text-[11px] text-text-secondary">Fallback {i + 1}</span>
                  <span className="rounded-md bg-bg-surface px-2 py-0.5 text-text-secondary">
                    {m}
                  </span>
                </span>
              ))}
              {c.nunca_externo && (
                <span className="ml-1 text-[11px] text-danger">nunca sai do Claude</span>
              )}
            </div>
            {c.fallback.length > 0 && (
              <p className="text-[11.5px] leading-relaxed text-text-secondary">
                Fallbacks são alternativas de contingência: cada um entra quando o modelo anterior
                falha ou bate quota. A tela não afirma que todos rodaram nesta ordem.
              </p>
            )}
            {c.effort && (
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-text-muted">
                esforço
                <span className="rounded-md bg-bg-surface px-2 py-0.5 font-semibold text-text-primary">
                  {c.effort}
                </span>
                {c.effort_teto && c.effort_teto !== c.effort && (
                  <>
                    <span className="text-[11px]">até</span>
                    <span className="rounded-md bg-bg-surface px-2 py-0.5 text-text-secondary">
                      {c.effort_teto}
                    </span>
                  </>
                )}
                {c.modelo_no_teto && (
                  <span className="ml-1 text-[11px] text-jade-accent">
                    única alavanca — modelo travado no topo
                  </span>
                )}
              </div>
            )}
            <div className="text-xs leading-relaxed text-text-muted">
              ✍ escreve o titular · ✔ revisa: {c.revisor}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] tabular-nums text-text-secondary">
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
              {t && t.julgaveis > 0 && (
                <span>
                  com terreno declarado{' '}
                  <b className="text-text-primary">
                    {t.classificados}/{t.julgaveis}
                  </b>
                </span>
              )}
            </div>
            <div className="text-[12.5px] text-text-muted">
              {t?.sinal.texto ?? 'sem dados — nenhum despacho neste terreno no período'}
            </div>
            {t?.ambiguo && (
              <div className="text-[12.5px] text-warning">
                ⚠ tarefas sem terreno declarado:{' '}
                {t.degrausAmbiguos
                  .map((d) => `${d.degrau} — ${d.ambiguos} de ${d.julgaveis}`)
                  .join(' · ')}
              </div>
            )}
          </Card>
        );
      })}
      {linhasDaFrente.length === 0 && (
        <p className="text-xs leading-relaxed text-warning">
          Sem dados da frente {nomeFrente} no período selecionado. Isso não significa que o modelo
          esteja sem evidência geral:{' '}
          {linhasGeraisDaFrente.length > 0
            ? `há ${linhasGeraisDaFrente.length} registro(s) desta frente em outras janelas.`
            : 'ainda não há registros gerais publicados para esta frente.'}
        </p>
      )}
    </div>
  );
}
