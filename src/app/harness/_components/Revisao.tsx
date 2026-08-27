import { MIN_AMOSTRA_GERAL, kpisRevisao } from '@/lib/harness/kpis';
import type { LedgerLinha } from '@/types/harness';
import { Card, pc } from './ui';

export function Revisao({ linhas }: { linhas: LedgerLinha[] }) {
  const kpis = kpisRevisao(linhas);
  const confiavel = kpis.julg >= MIN_AMOSTRA_GERAL;
  const intervalo = kpis.ic95 ? `${pc(kpis.ic95.min)}–${pc(kpis.ic95.max)}` : 'sem intervalo';

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <Card>
        <div className="text-xs font-semibold text-text-muted">Problemas encontrados</div>
        <div className="my-1 text-2xl font-bold tabular-nums">{pc(kpis.deteccao)}</div>
        <p className="text-[11.5px] leading-snug text-text-muted">
          {kpis.problemasN}/{kpis.julg} revisões carimbadas encontraram algo para corrigir · IC 95%{' '}
          {intervalo}
        </p>
      </Card>
      <Card>
        <div className="text-xs font-semibold text-text-muted">Como ler</div>
        <p className="mt-1 text-sm font-semibold text-text-primary">
          {confiavel ? 'Amostra suficiente para acompanhar a revisão' : 'Amostra ainda pequena'}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Taxa alta aqui não piora a qualidade de construção: significa que a revisão encontrou
          problemas. Construção e revisão nunca dividem o mesmo placar. A leitura vira decisória a
          partir de {MIN_AMOSTRA_GERAL} revisões julgáveis.
        </p>
      </Card>
    </div>
  );
}
