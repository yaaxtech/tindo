import { ROTULO_SEGMENTO, SEGMENTOS, segmentosGithub } from '@/lib/harness/github-timings';
import type { GithubRunLinha, SegmentoGithub } from '@/types/harness';
import { Card, PopoverInfo, Secao } from './ui';

const EXPLICACAO_SEGMENTO: Record<SegmentoGithub, string> = {
  fila_ci:
    'É o tempo que o robô de teste ficou esperando uma máquina livre antes de começar. Isso não depende do nosso código. Se crescer muito, a fila está no GitHub.',
  exec_ci:
    'É o tempo em que os testes e a checagem ficaram rodando de verdade. Se crescer, a suíte pode ter ficado pesada; este é o trecho que dá para otimizar no repositório.',
  espera_merge:
    'É o tempo em que o PR já estava pronto e verde, mas ficou esperando alguém apertar o botão de merge. É espera humana, não da máquina, e costuma ser o trecho mais fácil de cortar.',
  deploy:
    'É o tempo depois do merge até a nova versão do site ficar no ar. Se crescer, vale olhar a etapa de publicação e o serviço que coloca o site no ar.',
};

const EXPLICACAO_AMOSTRA =
  'A amostra mostra quantos runs (execuções automáticas do GitHub) entraram nesta conta nos últimos 7 dias. Quanto menor ela for, mais cuidado é preciso ao tirar conclusões.';

function formatarSegundos(segundos: number | null): string {
  if (segundos == null || !Number.isFinite(segundos) || segundos < 0) return '—';
  if (segundos < 90) return `${Math.round(segundos)} s`;
  if (segundos < 90 * 60) return `${Math.round(segundos / 60)} min`;
  return `${(segundos / 3600).toFixed(1)} h`;
}

function textoP50(segmento: SegmentoGithub): string {
  return `${EXPLICACAO_SEGMENTO[segmento]} p50 é o tempo típico: metade das vezes foi mais rápido que isso.`;
}

function textoP90(segmento: SegmentoGithub): string {
  return `${EXPLICACAO_SEGMENTO[segmento]} p90 mostra os casos mais lentos: só 1 em 10 foi mais lento que isso.`;
}

export function TemposGithub({ runs }: { runs: GithubRunLinha[] | undefined }) {
  const resumo = runs ? segmentosGithub(runs, { janelaDias: 7 }).janela : null;

  return (
    <Secao
      titulo="Onde o tempo se perde (GitHub)"
      info="Separa a entrega em quatro esperas. Assim fica claro o que depende do GitHub, do repositório ou de uma decisão humana."
      escopo={{ tipo: 'fixo', rotulo: 'semanal' }}
    >
      {runs === undefined && (
        <Card>
          <p className="text-sm font-semibold text-text-primary">Carregando tempos do GitHub…</p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            O restante do painel continua disponível enquanto estes números chegam.
          </p>
        </Card>
      )}

      {runs?.length === 0 && (
        <Card className="text-center">
          <p className="text-sm font-semibold text-text-primary">Ainda sem tempos para mostrar</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-text-muted">
            A primeira coleta cai às seis da manhã; os números aparecem depois disso.
          </p>
        </Card>
      )}

      {runs && runs.length > 0 && resumo && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SEGMENTOS.map((segmento) => {
            const medida = resumo[segmento];
            const semAmostra = medida.n === 0;
            return (
              <Card key={segmento}>
                <div className="text-xs font-semibold text-text-muted">
                  {ROTULO_SEGMENTO[segmento]}
                </div>
                <div className="my-1 flex items-center text-2xl font-bold tabular-nums text-jade-accent sm:text-[28px]">
                  <span>{formatarSegundos(medida.p50)}</span>
                  <PopoverInfo
                    texto={textoP50(segmento)}
                    label={`entenda o p50 de ${ROTULO_SEGMENTO[segmento]}`}
                  />
                </div>
                <div className="text-[11.5px] leading-snug text-text-muted">
                  {semAmostra ? (
                    <span>
                      sem amostra ainda nesta semana
                      <PopoverInfo
                        texto={EXPLICACAO_AMOSTRA}
                        label={`entenda a amostra de ${ROTULO_SEGMENTO[segmento]}`}
                      />
                    </span>
                  ) : (
                    <>
                      <span className="tabular-nums">
                        p90 {formatarSegundos(medida.p90)}
                        <PopoverInfo
                          texto={textoP90(segmento)}
                          label={`entenda o p90 de ${ROTULO_SEGMENTO[segmento]}`}
                        />
                      </span>
                      {' · '}
                      <span className="tabular-nums">
                        amostra {medida.n} {medida.n === 1 ? 'run' : 'runs'}
                        <PopoverInfo
                          texto={EXPLICACAO_AMOSTRA}
                          label={`entenda a amostra de ${ROTULO_SEGMENTO[segmento]}`}
                        />
                      </span>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
          <p className="col-span-full mt-0.5 text-xs leading-relaxed text-text-muted">
            Somar dois destes nunca conta o mesmo relógio duas vezes. Fila do CI em{' '}
            <span className="tabular-nums">0 s</span> é sinal bom: havia máquina livre na hora — não
            é número quebrado.
          </p>
        </div>
      )}
    </Secao>
  );
}
