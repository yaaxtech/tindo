import { cn } from '@/lib/utils';
import type { HarnessBlob } from '@/types/harness';
import { Card, corPill, pc } from './ui';
import type { FontesHarness, StatusFonteHarness } from './useDadosHarness';

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

const MOTIVO_REJEICAO: Record<string, string> = {
  sem_ts: 'sem data',
  sem_frente: 'sem frente',
  sem_modelo: 'sem modelo',
  sem_resultado: 'sem resultado',
  papel_ausente: 'sem papel',
  papel_inferido: 'papel deduzido',
  terreno_ausente: 'sem terreno',
};

const rotuloMotivo = (motivo: string): string =>
  MOTIVO_REJEICAO[motivo] ?? motivo.replaceAll('_', ' ');

const rotuloFonte: Record<keyof FontesHarness, string> = {
  snapshot: 'Snapshot principal',
  githubRuns: 'GitHub runs',
  minutos: 'Minutos do GitHub',
  alertas: 'Alertas',
};

const rotuloEstado: Record<StatusFonteHarness['estado'], string> = {
  carregando: 'carregando',
  fresco: 'leitura atual',
  vazio: 'vazio',
  anterior: 'leitura anterior mantida',
  erro: 'erro',
};

export function SaudeDados({
  dados,
  contratoValido,
  fontes,
}: { dados: HarnessBlob; contratoValido: boolean; fontes?: FontesHarness }) {
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
  const rejeicoes = Object.entries(saude?.rejeicoes_por_motivo ?? {}).filter(
    ([, quantidade]) => quantidade > 0,
  );

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
        <div className="text-xs font-semibold text-text-muted">Fontes desta tela</div>
        {fontes ? (
          <div className="mt-2 space-y-1.5 text-[11.5px] leading-snug">
            {(Object.keys(rotuloFonte) as (keyof FontesHarness)[]).map((chave) => {
              const fonte = fontes[chave];
              const aviso = fonte.estado === 'erro' || fonte.estado === 'anterior' || fonte.velho;
              return (
                <div key={chave} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="font-semibold text-text-secondary">{rotuloFonte[chave]}</span>
                  <span className={cn(aviso ? 'text-warning' : 'text-text-muted')}>
                    {rotuloEstado[fonte.estado]}
                    {fonte.velho && ' · fonte velha'}
                  </span>
                  {fonte.atualizadoEm && (
                    <span className="text-text-muted">· {dataHora(fonte.atualizadoEm)}</span>
                  )}
                  {fonte.mensagem && <span className="text-warning">· origem: {fonte.origem}</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-1 text-[11.5px] leading-snug text-text-muted">
            O status individual das fontes ainda não está disponível nesta leitura.
          </p>
        )}
      </Card>

      <Card>
        <div className="text-xs font-semibold text-text-muted">Rejeições da coleta</div>
        <p className="mt-1 text-[11.5px] leading-snug text-text-muted">
          {saude
            ? `${saude.eventos_recebidos} recebidos · ${saude.eventos_publicados} publicados · ${saude.eventos_rejeitados} rejeitados.`
            : 'Sem contagem de coleta neste snapshot.'}
        </p>
        {rejeicoes.length > 0 ? (
          <ul className="mt-2 space-y-1 text-[11.5px] leading-snug text-text-muted">
            {rejeicoes.map(([motivo, quantidade]) => (
              <li key={motivo} className="flex justify-between gap-3">
                <span>{rotuloMotivo(motivo)}</span>
                <span className="tabular-nums">{quantidade}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11.5px] leading-snug text-text-muted">
            Nenhum motivo de rejeição foi publicado.
          </p>
        )}
      </Card>

      <Card>
        <div className="text-xs font-semibold text-text-muted">Atualidade da fonte</div>
        <div className="my-1 text-lg font-bold tabular-nums">{dataHora(saude?.source_max_ts)}</div>
        <p className="text-[11.5px] leading-snug text-text-muted">
          atraso na geração: {atraso(saude?.atraso_fonte_seg)} · registros rejeitados:{' '}
          {saude?.eventos_rejeitados ?? '—'}
        </p>
      </Card>

      <Card>
        <div className="text-xs font-semibold text-text-muted">Papéis carimbados</div>
        <div className="my-1 text-2xl font-bold tabular-nums">{pc(coberturaPapel)}</div>
        <p className="text-[11.5px] leading-snug text-text-muted">
          {saude
            ? `${saude.papel_explicito}/${saude.eventos_publicados} registros dizem se eram construção ou revisão. O restante não decide qualidade.`
            : 'Sem cobertura informada neste snapshot.'}
        </p>
      </Card>

      <Card>
        <div className="text-xs font-semibold text-text-muted">Duração total registrada</div>
        <div className="my-1 text-2xl font-bold tabular-nums">{pc(coberturaDuracao)}</div>
        <p className="text-[11.5px] leading-snug text-text-muted">
          {saude
            ? `${saude.duracao_preenchida}/${saude.eventos_publicados} registros têm duração. Os percentis mostram sempre o n usado.${historicoLegado ? ` ${historicoLegado} fotos antigas ficaram em quarentena por usarem a fórmula anterior.` : ''}`
            : 'Sem cobertura informada neste snapshot.'}
        </p>
      </Card>
    </div>
  );
}
