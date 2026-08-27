import { cn } from '@/lib/utils';
import type { HarnessBlob } from '@/types/harness';
import { Card, corPill, pc } from './ui';

const dataHora = (iso: string | null | undefined): string => {
  if (!iso) return 'ainda não informado';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return 'data inválida';
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const atraso = (segundos: number | null | undefined): string => {
  if (segundos == null) return 'sem medição';
  if (segundos < 90) return `${segundos} s`;
  if (segundos < 5400) return `${Math.round(segundos / 60)} min`;
  return `${(segundos / 3600).toFixed(1)} h`;
};

export function SaudeDados({
  dados,
  contratoValido,
}: { dados: HarnessBlob; contratoValido: boolean }) {
  const saude = dados.saude_dados;
  const coberturaPapel = saude?.papel_explicito_pct ?? null;
  const coberturaDuracao = saude?.duracao_preenchida_pct ?? null;
  const historicoLegado =
    saude?.historico_legado ??
    dados.history.filter(
      (linha) =>
        linha.schema_version !== dados.schema_version ||
        linha.metric_version !== dados.metric_version,
    ).length;

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              corPill(contratoValido ? 'good' : 'warn'),
            )}
          >
            {contratoValido ? 'fonte íntegra e versionada' : 'snapshot incompatível'}
          </span>
          <span className="text-sm font-semibold">Contrato dos dados</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-text-muted">
          {contratoValido
            ? `Versão ${dados.schema_version} · cálculo ${dados.metric_version}. A página recebe números estruturados já calculados e um recibo Markdown é gerado na máquina.`
            : 'A versão, os períodos ou as somas deste snapshot não fecharam. Os números decisórios ficam suspensos até a próxima publicação íntegra.'}
        </p>
      </Card>

      <Card>
        <div className="text-xs font-semibold text-text-muted">Atualidade da fonte</div>
        <div className="my-1 text-lg font-bold tabular-nums">{dataHora(saude?.source_max_ts)}</div>
        <p className="text-[11.5px] leading-snug text-text-muted">
          atraso na geração: {atraso(saude?.atraso_fonte_seg)} · rejeitados:{' '}
          {saude?.eventos_rejeitados ?? '—'}
        </p>
      </Card>

      <Card>
        <div className="text-xs font-semibold text-text-muted">Papéis carimbados</div>
        <div className="my-1 text-2xl font-bold tabular-nums">{pc(coberturaPapel)}</div>
        <p className="text-[11.5px] leading-snug text-text-muted">
          {saude
            ? `${saude.papel_explicito}/${saude.eventos_publicados} eventos dizem se eram construção ou revisão. O restante não decide qualidade.`
            : 'Sem cobertura informada neste snapshot.'}
        </p>
      </Card>

      <Card>
        <div className="text-xs font-semibold text-text-muted">Duração preenchida</div>
        <div className="my-1 text-2xl font-bold tabular-nums">{pc(coberturaDuracao)}</div>
        <p className="text-[11.5px] leading-snug text-text-muted">
          {saude
            ? `${saude.duracao_preenchida}/${saude.eventos_publicados} eventos têm duração. Os percentis mostram sempre o n usado.${historicoLegado ? ` ${historicoLegado} fotos antigas ficaram em quarentena por usarem a fórmula anterior.` : ''}`
            : 'Sem cobertura informada neste snapshot.'}
        </p>
      </Card>
    </div>
  );
}
