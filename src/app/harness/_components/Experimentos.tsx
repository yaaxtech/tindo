import { EXPERIMENTOS_AB, NOTA_EXPERIMENTOS } from '@/lib/harness/experimentos';
import { cn } from '@/lib/utils';
import type { BenchmarkModelosPublicado, ExperimentosPublicados } from '@/types/harness';
import { Card, corPill } from './ui';

const FRENTE_LBL: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
};

const numero = (valor: number): string => valor.toLocaleString('pt-BR');

function mediana(valor: number | null, unidade: string): string {
  if (valor == null) return '—';
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unidade}`;
}

function BracoPublicado({
  braco,
}: {
  braco: ExperimentosPublicados['experimentos'][number]['bracos'][number];
}) {
  return (
    <li className="rounded-md bg-bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-text-primary">
          {braco.id} · {braco.modelo}/{braco.effort}
        </span>
        <span className="text-[11px] text-text-muted">braço publicado</span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] tabular-nums text-text-secondary sm:grid-cols-4">
        <div>
          <dt>Execuções</dt>
          <dd className="font-semibold text-text-primary">{numero(braco.execucoes)}</dd>
        </div>
        <div>
          <dt>Julgados</dt>
          <dd className="font-semibold text-text-primary">{numero(braco.julgados)}</dd>
        </div>
        <div>
          <dt>Acerto n/d</dt>
          <dd className="font-semibold text-text-primary">
            {numero(braco.ok1)}/{numero(braco.julgados)}
          </dd>
        </div>
        <div>
          <dt>Retrabalho</dt>
          <dd className="font-semibold text-text-primary">{numero(braco.retrabalho)}</dd>
        </div>
        <div>
          <dt>Quota</dt>
          <dd className="font-semibold text-text-primary">{numero(braco.quota)}</dd>
        </div>
        <div>
          <dt>Infra</dt>
          <dd className="font-semibold text-text-primary">{numero(braco.infra)}</dd>
        </div>
        <div>
          <dt>Tokens mediana</dt>
          <dd className="font-semibold text-text-primary">
            {mediana(braco.tokens_mediana, 'tokens')}
          </dd>
        </div>
        <div>
          <dt>Duração mediana</dt>
          <dd className="font-semibold text-text-primary">
            {mediana(braco.duracao_mediana_min, 'min')}
          </dd>
        </div>
        <div>
          <dt>Tokens medidos/julgados</dt>
          <dd className="font-semibold text-text-primary">
            {braco.tokens_medidos == null
              ? '—'
              : `${numero(braco.tokens_medidos)}/${numero(braco.julgados)}`}
          </dd>
        </div>
        <div>
          <dt>Pendentes</dt>
          <dd className="font-semibold text-text-primary">
            {braco.pendentes == null ? '—' : numero(braco.pendentes)}
          </dd>
        </div>
        <div>
          <dt>Modelo/esforço confirmados</dt>
          <dd className="font-semibold text-text-primary">
            {braco.modelos_confirmados == null
              ? '—'
              : `${numero(braco.modelos_confirmados)}/${numero(braco.julgados)}`}
          </dd>
        </div>
        <div>
          <dt>Falhas</dt>
          <dd className="font-semibold text-text-primary">
            {braco.falhas == null ? '—' : numero(braco.falhas)}
          </dd>
        </div>
        <div>
          <dt>Durações medidas</dt>
          <dd className="font-semibold text-text-primary">
            {braco.duracoes_medidas == null ? '—' : numero(braco.duracoes_medidas)}
          </dd>
        </div>
      </dl>
    </li>
  );
}

function BenchmarkModelos({ dados }: { dados: BenchmarkModelosPublicado }) {
  return (
    <details className="rounded-xl border border-border-strong bg-bg-elevated/60 px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-text-secondary">
        Benchmark externo — {dados.fonte}
      </summary>
      <div className="mt-3 flex flex-col gap-2.5 text-xs leading-relaxed text-text-secondary">
        <p>
          Consultado em {dados.consultado_em} ·{' '}
          <a
            href={dados.url}
            target="_blank"
            rel="noreferrer"
            className="text-jade-accent underline-offset-2 hover:underline"
          >
            abrir fonte
          </a>
        </p>
        <p>Projeção: {dados.projecao}</p>
        <p>{dados.nota}</p>
        <p className="text-warning">
          Benchmark externo não prova o esforço local. Output tokens não é cota do ChatGPT.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border-strong">
          <table className="w-full min-w-[620px] border-collapse text-[11.5px] tabular-nums">
            <thead>
              <tr className="text-left uppercase tracking-wider text-text-muted">
                {[
                  'Modelo',
                  'Organização',
                  'Score',
                  'Margem',
                  'Sessões',
                  'Tokens p50',
                  'Amostra tokens',
                ].map((cabecalho) => (
                  <th key={cabecalho} className="border-b border-border px-2.5 py-2 font-semibold">
                    {cabecalho}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.modelos.map((modelo) => (
                <tr key={modelo.id} className="last:[&>td]:border-b-0">
                  <td className="border-b border-border px-2.5 py-2 font-semibold text-text-primary">
                    {modelo.nome}
                  </td>
                  <td className="border-b border-border px-2.5 py-2">{modelo.organizacao}</td>
                  <td className="border-b border-border px-2.5 py-2">{modelo.score.toFixed(3)}</td>
                  <td className="border-b border-border px-2.5 py-2">
                    {modelo.score_margem == null ? '—' : modelo.score_margem.toFixed(3)}
                  </td>
                  <td className="border-b border-border px-2.5 py-2">{numero(modelo.sessoes)}</td>
                  <td className="border-b border-border px-2.5 py-2">
                    {modelo.output_tokens_mediana == null
                      ? '—'
                      : numero(modelo.output_tokens_mediana)}
                  </td>
                  <td className="border-b border-border px-2.5 py-2">
                    {numero(modelo.amostra_tokens)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function HistoricoManual() {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Histórico de pilotos manuais
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Registros históricos preservados para contexto. Eles não são resultados pareados e não
          foram usados para declarar vencedor.
        </p>
      </div>
      {EXPERIMENTOS_AB.map((exp) => (
        <Card key={exp.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-bold">{exp.frente}</span>
              <span className="ml-2 text-text-muted">{exp.pergunta}</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  corPill('mut'),
                )}
              >
                histórico manual
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  corPill('mut'),
                )}
              >
                {exp.status}
              </span>
            </div>
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
    </div>
  );
}

/** Resultados A/B medidos pelo publicador, com o histórico manual preservado abaixo. */
export function Experimentos({
  dados,
  benchmarkModelos,
}: {
  dados?: ExperimentosPublicados | null;
  benchmarkModelos?: BenchmarkModelosPublicado;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {dados ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm leading-relaxed text-text-secondary">
            Resultados automáticos publicados em {dados.gerado_em}. O status e o motivo vêm do
            publicador; a tela não calcula vencedor a partir do ledger histórico. Configurar ou
            sortear um braço sem executar uma tarefa não conta como teste.
          </p>
          {dados.experimentos.length === 0 ? (
            <Card>
              <p className="text-[13px] text-text-muted">
                Nenhum resultado automático foi publicado nesta coleta.
              </p>
            </Card>
          ) : (
            dados.experimentos.map((exp) => (
              <Card key={exp.id} className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-bold">{exp.id}</span>
                    <span className="ml-2 text-text-muted">
                      {FRENTE_LBL[exp.frente] ?? exp.frente} · {exp.terreno}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      corPill('mut'),
                    )}
                  >
                    {exp.status}
                  </span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-text-secondary">
                  Motivo publicado: {exp.motivo}
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {exp.bracos.map((braco) => (
                    <BracoPublicado key={braco.id} braco={braco} />
                  ))}
                </ul>
              </Card>
            ))
          )}
          {benchmarkModelos && <BenchmarkModelos dados={benchmarkModelos} />}
        </div>
      ) : (
        <Card>
          <p className="text-sm leading-relaxed text-text-secondary">
            Dados novos: resultados automáticos ainda não publicados. O histórico manual abaixo
            continua disponível para contexto.
          </p>
        </Card>
      )}

      {!dados && benchmarkModelos && <BenchmarkModelos dados={benchmarkModelos} />}

      <HistoricoManual />
      <p className="text-xs leading-relaxed text-text-muted">
        Resultados automáticos e pilotos históricos ficam separados do histórico de uso. Os modelos
        atuais continuam em uso até um teste medido justificar uma troca.
      </p>
    </div>
  );
}
