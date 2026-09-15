import type { AutorregulacaoPublicada } from '@/types/harness';
import { Card, corPill } from './ui';

export function Autorregulacao({ dados }: { dados?: AutorregulacaoPublicada | null }) {
  if (!dados) {
    return (
      <Card>
        <div className="text-xs font-semibold text-text-muted">Autorregulação</div>
        <p className="mt-1 text-sm text-text-secondary">
          Dados de autorregulação ainda não publicados.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-muted">Autorregulação</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${corPill(dados.habilitada ? 'good' : 'mut')}`}
        >
          {dados.habilitada ? 'habilitada' : 'desabilitada'}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-text-secondary">{dados.motivo}</p>
      <p className="text-xs leading-relaxed text-text-muted">
        Última mudança: {dados.ultima_mudanca ?? 'nenhuma mudança registrada'} · publicado em{' '}
        {dados.gerado_em}
      </p>
    </Card>
  );
}
