import { EXPERIMENTOS_AB, NOTA_EXPERIMENTOS } from '@/lib/harness/experimentos';
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
      <p className="text-sm leading-relaxed text-text-secondary">
        Interface e design continuam com Claude. Os novos testes cobrem trabalho de escopo fechado;
        SQL, dinheiro, produção, arquitetura e pesquisa abertas ficam fora. Nenhum padrão foi
        alterado.
      </p>
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
              {exp.status}
            </span>
          </div>
          <ul
            className={cn(
              'grid gap-2 sm:grid-cols-2',
              exp.candidatos.length === 3 && 'lg:grid-cols-3',
            )}
          >
            {exp.candidatos.map((c) => (
              <li key={c} className="rounded-md bg-bg-surface px-3 py-2 text-[12.5px]">
                <span className="font-semibold text-text-primary">{c}</span>
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] leading-relaxed text-text-secondary">{exp.resumo}</p>
          {exp.criterio && (
            <details className="text-xs leading-relaxed text-text-secondary">
              <summary className="cursor-pointer font-semibold">Como testar e decidir</summary>
              <p className="mt-2">{exp.criterio}</p>
            </details>
          )}
        </Card>
      ))}
      <p className="text-xs leading-relaxed text-warning">{NOTA_EXPERIMENTOS}</p>
      <p className="text-xs leading-relaxed text-text-muted">
        Resultados de pilotos e planos de novos testes ficam separados do histórico de uso. Os
        modelos atuais continuam em uso até os testes justificarem uma troca.
      </p>
    </div>
  );
}
