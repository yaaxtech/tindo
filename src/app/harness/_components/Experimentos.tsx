import { EXPERIMENTOS_AB, NOTA_EXPERIMENTOS, STATUS_EXPERIMENTO } from '@/lib/harness/experimentos';
import { cn } from '@/lib/utils';
import { Card, corPill } from './ui';

/**
 * Experimentos A/B do plano. Só os candidatos fixos (ver experimentos.ts), um
 * status textual e o resumo escrito do piloto. Sem contagem, sem taxa: o
 * ledger histórico não é resultado pareado, e o piloto roda fora do painel,
 * em recibos separados.
 */
export function Experimentos() {
  return (
    <div className="flex flex-col gap-2.5">
      {EXPERIMENTOS_AB.map((exp) => (
        <Card key={exp.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-bold">{exp.frente}</span>
              <span className="ml-2 text-text-muted">{exp.pergunta}</span>
            </div>
            <span
              className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', corPill('mut'))}
            >
              {STATUS_EXPERIMENTO}
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {exp.candidatos.map((c) => (
              <li key={c} className="rounded-md bg-bg-surface px-3 py-2 text-[12.5px]">
                <span className="font-semibold text-text-primary">{c}</span>
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] leading-relaxed text-text-secondary">{exp.resumo}</p>
        </Card>
      ))}
      <p className="text-xs leading-relaxed text-warning">{NOTA_EXPERIMENTOS}</p>
      <p className="text-xs leading-relaxed text-text-muted">
        Os registros históricos do ledger não são resultados pareados e não entram aqui. O piloto
        roda fora do painel, em recibos separados, e o resumo acima é escrito à mão a partir deles.
        A promoção de um candidato depende dos critérios do teste, nunca de uma leitura visual das
        taxas, e nenhum candidato substitui o titular de um terreno até isso acontecer.
      </p>
    </div>
  );
}
