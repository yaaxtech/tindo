import {
  type SegmentoDespacho,
  medidasDoLedger,
  porFrente,
  resumoDespacho,
} from '@/lib/harness/tempos-despacho';
import type { LedgerLinha } from '@/types/harness';
import { Card, PopoverInfo, Secao, formatarSegundos } from './ui';

const SEGMENTOS: readonly SegmentoDespacho[] = ['execucao', 'revisao', 'total'];
const FRENTES: readonly LedgerLinha['frente'][] = ['codex', 'kimi', 'claude', 'cerebro'];

const ROTULO_SEGMENTO: Record<SegmentoDespacho, string> = {
  execucao: 'Execução do worker',
  revisao: 'Revisão do cérebro',
  total: 'Total real',
};

const ROTULO_FRENTE: Record<LedgerLinha['frente'], string> = {
  codex: 'Codex',
  kimi: 'Kimi',
  claude: 'Claude',
  cerebro: 'Cérebro',
};

const EXPLICACAO_SEGMENTO: Record<SegmentoDespacho, string> = {
  execucao:
    'É o tempo que o worker (o robô que executa a tarefa) passou trabalhando, segundo o registro automático feito quando ele termina.',
  revisao:
    'É o tempo entre o worker terminar e a tarefa ser fechada. Inclui ler a entrega, conferir o resultado e decidir se ela foi aceita ou precisa de outro ciclo.',
  total:
    'É a soma da execução com a revisão. Uma tarefa só entra aqui quando os dois tempos existem; nada é estimado.',
};

const EXPLICACAO_AMOSTRA =
  'A amostra mostra quantos despachos tiveram os marcos necessários para este número no período escolhido. Cada segmento pode ter uma amostra diferente.';

const EXPLICACAO_FRENTE =
  'É o p50 da execução desta frente: em metade dos despachos medidos, o worker terminou nesse tempo ou menos.';

function textoP50(segmento: SegmentoDespacho): string {
  return `${EXPLICACAO_SEGMENTO[segmento]} p50 é o tempo típico: metade dos despachos medidos terminou este trecho nesse tempo ou menos.`;
}

function textoP90(segmento: SegmentoDespacho): string {
  return `${EXPLICACAO_SEGMENTO[segmento]} p90 mostra os casos mais lentos: só 1 em 10 levou mais tempo que isso.`;
}

function formatarMinutos(minutos: number | null): string {
  return formatarSegundos(minutos == null ? null : minutos * 60);
}

export function TemposDespacho({
  linhas,
  janelaDias,
  id,
}: {
  linhas: LedgerLinha[];
  janelaDias: number;
  id?: string;
}) {
  const medidas = medidasDoLedger(linhas);
  const resumo = resumoDespacho(medidas, janelaDias);
  const frentes = porFrente(medidas);
  const semMarcos = SEGMENTOS.every((segmento) => resumo[segmento].n === 0);

  return (
    <Secao
      titulo="Onde o tempo se perde — do despacho ao aceite"
      info="Separa o tempo real do worker e o tempo da revisão, usando os marcos que o ledger já grava automaticamente."
      escopo={{ tipo: 'filtro', dias: janelaDias }}
      id={id}
    >
      {semMarcos ? (
        <Card className="text-center">
          <p className="text-sm font-semibold text-text-primary">
            Ainda sem tempos automáticos para mostrar
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-text-muted">
            Só despachos automáticos dos workers, feitos pelo run.sh, têm esses marcos. O restante
            do painel continua funcionando normalmente.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {SEGMENTOS.map((segmento) => {
            const medida = resumo[segmento];
            const semAmostra = medida.n === 0;
            return (
              <Card key={segmento}>
                <div className="text-xs font-semibold text-text-muted">
                  {ROTULO_SEGMENTO[segmento]}
                </div>
                <div className="my-1 flex items-center text-2xl font-bold tabular-nums text-jade-accent sm:text-[28px]">
                  <span>{formatarMinutos(medida.p50)}</span>
                  <PopoverInfo
                    texto={textoP50(segmento)}
                    label={`entenda o p50 de ${ROTULO_SEGMENTO[segmento]}`}
                  />
                </div>
                <div className="text-[11.5px] leading-snug text-text-muted">
                  {semAmostra ? (
                    <span>
                      sem amostra neste período
                      <PopoverInfo
                        texto={EXPLICACAO_AMOSTRA}
                        label={`entenda a amostra de ${ROTULO_SEGMENTO[segmento]}`}
                      />
                    </span>
                  ) : (
                    <>
                      <span className="tabular-nums">
                        p90 {formatarMinutos(medida.p90)}
                        <PopoverInfo
                          texto={textoP90(segmento)}
                          label={`entenda o p90 de ${ROTULO_SEGMENTO[segmento]}`}
                        />
                      </span>
                      {' · '}
                      <span className="tabular-nums">
                        amostra {medida.n} {medida.n === 1 ? 'despacho' : 'despachos'}
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

          {/* Aqui o p90 é OBRIGATÓRIO ao lado do p50, e não um detalhe: só com
              o p50 a leitura inverte a realidade. Nos dados de 13/08 o Codex
              marcava p50 11 min e o Kimi 14 — o Kimi parecia o lento. Mas a
              cauda é inteira do Codex: p90 96 min contra 19 do Kimi. É a cauda
              que come a tarde, não a mediana.
              Frente sem nenhum despacho medido não vira linha: Claude e cérebro
              não passam pelos run.sh, então ficariam eternamente em branco
              ensinando nada. A lib continua devolvendo as quatro. */}
          <div className="col-span-full mt-1">
            <div className="text-xs font-semibold text-text-muted">
              Execução por frente — típica e cauda
            </div>
            <div className="mt-2 divide-y divide-border border-y border-border">
              {FRENTES.filter((frente) => frentes[frente].execucao.n > 0).map((frente) => {
                const execucao = frentes[frente].execucao;
                return (
                  <div
                    key={frente}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="text-xs text-text-primary">{ROTULO_FRENTE[frente]}</span>
                    <span className="text-xs tabular-nums text-text-muted">
                      <span className="font-semibold text-text-primary">
                        {formatarMinutos(execucao.p50)}
                      </span>
                      <PopoverInfo
                        texto={EXPLICACAO_FRENTE}
                        label={`entenda a execução típica de ${ROTULO_FRENTE[frente]}`}
                      />
                      {' · pior 1 em 10: '}
                      <span className="font-semibold text-text-primary">
                        {formatarMinutos(execucao.p90)}
                      </span>
                      <PopoverInfo
                        texto={`É o p90 desta frente: 1 em cada 10 despachos levou MAIS que isso executando. É a cauda que estraga a tarde — uma mediana boa não salva quem espera o caso ruim. ${ROTULO_FRENTE[frente]} tem ${execucao.n} despacho${execucao.n === 1 ? '' : 's'} medido${execucao.n === 1 ? '' : 's'} no período.`}
                        label={`entenda a cauda de ${ROTULO_FRENTE[frente]}`}
                      />
                      {' · amostra '}
                      {execucao.n}
                      <PopoverInfo
                        texto={EXPLICACAO_AMOSTRA}
                        label={`entenda a amostra de ${ROTULO_FRENTE[frente]}`}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <p className="mt-2.5 text-xs leading-relaxed text-text-muted">
        O tempo de preparo do despacho — escrever a tarefa antes de enviar — não entra em nenhum
        destes números.
      </p>
    </Secao>
  );
}
