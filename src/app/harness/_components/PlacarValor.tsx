import { MIN_AMOSTRA_GERAL, kpisGerais, placarPorFrente, valorGeral } from '@/lib/harness/kpis';
import { cn } from '@/lib/utils';
import type { Assinatura, LedgerLinha } from '@/types/harness';
import { Card, PopoverInfo } from './ui';

const NOMES_FRENTE: Record<string, string> = {
  codex: 'Codex/GPT',
  kimi: 'Kimi/K3',
  claude: 'Claude',
};

function corValor(valor: number | null): string {
  if (valor == null) return 'text-text-muted';
  if (valor >= 75) return 'text-success';
  if (valor >= 55) return 'text-jade-accent';
  if (valor >= 40) return 'text-warning';
  return 'text-danger';
}

function fundoValor(valor: number | null): string {
  if (valor == null) return 'bg-text-muted';
  if (valor >= 75) return 'bg-success';
  if (valor >= 55) return 'bg-jade-accent';
  if (valor >= 40) return 'bg-warning';
  return 'bg-danger';
}

export function PlacarValor({
  linhas,
  assinaturas,
  janelaDias,
}: {
  linhas: LedgerLinha[];
  assinaturas: Assinatura[];
  janelaDias: number;
}) {
  const geral = valorGeral(linhas, assinaturas, janelaDias);
  const amostraGeral = kpisGerais(linhas).julg;
  const frentes = placarPorFrente(linhas, assinaturas, janelaDias);

  return (
    <Card>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:items-center">
        <div>
          <div className="text-xs font-semibold text-text-muted">
            Placar de Valor
            <PopoverInfo
              texto={`Um número de 0 a 100 que junta qualidade, economia e disponibilidade. Barato mas ruim não sobe. Como a qualidade é o maior peso, o placar só aparece a partir de ${MIN_AMOSTRA_GERAL} construções julgáveis; antes disso seria precisão falsa.`}
            />
          </div>
          <div className={cn('mt-1 text-4xl font-bold tabular-nums', corValor(geral))}>
            {geral == null ? '—' : geral}
          </div>
          <div className="text-[11.5px] text-text-muted">
            {geral != null
              ? 'de 100'
              : `amostra insuficiente · ${amostraGeral}/${MIN_AMOSTRA_GERAL}`}
          </div>
        </div>

        <div className="space-y-3">
          {frentes.map((item) => (
            <div key={item.frente}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-text-secondary">
                  {NOMES_FRENTE[item.frente] ?? item.frente}
                </span>
                <span className={cn('font-semibold tabular-nums', corValor(item.valor))}>
                  {item.valor == null ? `— · ${item.julg}/${MIN_AMOSTRA_GERAL}` : item.valor}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-surface">
                <div
                  className={cn('h-full rounded-full transition-all', fundoValor(item.valor))}
                  style={{ width: `${item.valor ?? 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
