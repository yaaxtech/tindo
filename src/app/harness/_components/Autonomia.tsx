import { type AutonomiaKpi, kpisAutonomia } from '@/lib/harness/kpis';
import { cn } from '@/lib/utils';
import type { AutonomiaBlob } from '@/types/harness';
import { Card, PopoverInfo, pc } from './ui';

const COMO_PERGUNTAS =
  'Toda vez que o assistente para o trabalho e abre aquela caixinha de opções para você escolher. Contado direto do histórico das sessões, dia a dia. Quanto menor, mais ele resolve sozinho.';
const COMO_ACEITE =
  'Das perguntas que você respondeu, quantas terminaram na PRIMEIRA opção — que é sempre a recomendada. Aceite muito alto quer dizer que a pergunta não precisava existir: era para eu ter decidido.';
const COMO_CORRECAO =
  'Você respondeu por fora da lista, trazendo uma regra da fazenda que só você sabia. Essa é a pergunta que VALEU — é ela que eu quero continuar fazendo.';
const COMO_ESPERA =
  'Perguntas que ficaram mais de uma hora na tela sem resposta. Cada uma dessas é uma sessão parada esperando você.';
const COMO_N2 =
  'Nível 2 da regra de autonomia: decisões que eu tomei sozinho, apliquei e só carimbei para você revisar depois. "Você desfez" conta quantas você mandou voltar atrás — é o freio que diz se estou passando do ponto.';

function corVeredito(tipo: AutonomiaKpi['veredito']['tipo']): string {
  if (tipo === 'decidindo-demais') return 'bg-warning/15 text-warning';
  if (tipo === 'perguntando-demais') return 'bg-jade/20 text-jade-accent';
  return 'bg-bg-surface text-text-muted';
}

/** Uma métrica em linha: rótulo, valor e a amostra x/y (padrão da casa). */
function Linha({
  rotulo,
  valor,
  amostra,
  como,
  destaque,
}: {
  rotulo: string;
  valor: string;
  amostra?: string;
  como: string;
  destaque?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
      <span className="text-text-secondary">
        {rotulo}
        <PopoverInfo texto={como} />
      </span>
      <span className={cn('font-bold tabular-nums', destaque ?? 'text-text-primary')}>{valor}</span>
      {amostra && <span className="tabular-nums text-text-muted">({amostra})</span>}
    </div>
  );
}

export function Autonomia({
  autonomia,
  janelaDias,
}: {
  autonomia: AutonomiaBlob | null | undefined;
  janelaDias: number;
}) {
  const k = kpisAutonomia(autonomia, janelaDias);

  return (
    <Card>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:items-center">
        <div>
          <div className="text-xs font-semibold text-text-muted">
            Perguntas por dia
            <PopoverInfo texto={COMO_PERGUNTAS} />
          </div>
          <div className="mt-1 text-4xl font-bold tabular-nums text-text-primary">
            {k.perguntasPorDia ?? '— · coletando dados'}
          </div>
          {k.perguntas > 0 && (
            <div className="text-[11.5px] text-text-muted">
              {k.perguntas} {k.perguntas === 1 ? 'pergunta' : 'perguntas'} no período
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Linha
            rotulo="Aceitou a recomendada"
            valor={pc(k.aceitePct)}
            amostra={k.perguntas ? `${k.aceitouN}/${k.perguntas}` : undefined}
            como={COMO_ACEITE}
          />
          <Linha
            rotulo="Corrigiu o rumo"
            valor={pc(k.correcoesPct)}
            amostra={k.perguntas ? `${k.corrigiuN}/${k.perguntas}` : undefined}
            como={COMO_CORRECAO}
            destaque="text-jade-accent"
          />
          <Linha
            rotulo="Ficaram mais de 1h na tela"
            valor={String(k.esperasLongas)}
            como={COMO_ESPERA}
            destaque={k.esperasLongas > 0 ? 'text-warning' : undefined}
          />
          {k.n2Carimbadas > 0 ? (
            <Linha
              rotulo="Decidi sozinho"
              valor={String(k.n2Carimbadas)}
              amostra={`você desfez ${k.n2Desfeitas} · ${pc(k.n2DesfeitasPct)}`}
              como={COMO_N2}
            />
          ) : (
            <div className="text-xs text-text-muted">
              Ainda sem decisões carimbadas
              <PopoverInfo texto={COMO_N2} />
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          'mt-4 inline-block rounded-full px-2.5 py-1 text-[11.5px] font-medium',
          corVeredito(k.veredito.tipo),
        )}
      >
        {k.veredito.texto}
      </div>
    </Card>
  );
}
