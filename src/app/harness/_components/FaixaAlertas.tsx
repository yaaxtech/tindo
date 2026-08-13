import { ROTULO_ALERTA } from '@/lib/harness/alertas';
import { cn } from '@/lib/utils';
import type { HistoricoAlertas } from '@/services/harness';
import type { AlertaLinha, CodigoAlerta } from '@/types/harness';
import { Card, PopoverInfo, Secao, type Status, corPill, formatarSegundos } from './ui';

// Faixa de alerta do revisor de KPIs (topo do painel).
//
// Regra de escrita: o dono não é dev. Cada alerta responde três perguntas em
// uma frase cada — o que disparou, o que isso significa e o que ele pode
// fazer. Sem jargão, sem nome de função, sem número solto sem unidade.

/** O que significa e o que dá para fazer, por limiar. */
const TEXTO: Record<CodigoAlerta, { significa: string; fazer: string }> = {
  qualidade_baixa: {
    significa:
      'Boa parte das tarefas mandadas para os modelos voltou precisando de correção, em vez de sair pronta de primeira.',
    fazer:
      'Veja abaixo, em "Por terreno", qual tipo de trabalho está errando mais e suba o modelo dele.',
  },
  retrabalho_alto: {
    significa:
      'Muitas tarefas precisaram de uma rodada extra. Cada rodada extra custa um ciclo inteiro de despacho e revisão.',
    fazer:
      'É o mesmo problema visto de outro ângulo: o terreno marcado com ▲ abaixo é o que está puxando o número.',
  },
  custo_alto: {
    significa:
      'Cada tarefa entregue está saindo cara. As assinaturas têm preço fixo — quanto menos trabalho passa por elas, mais cara fica cada tarefa.',
    fazer:
      'Em "Assinaturas", veja qual está parada: ou mandar mais trabalho para ela, ou cancelá-la.',
  },
  quota_alta: {
    significa:
      'Vários despachos bateram no limite da assinatura e tiveram que ser desviados para outra frente.',
    fazer: 'A assinatura saturada aparece em "Assinaturas" como candidata a aumentar de plano.',
  },
  quota_zerada: {
    significa:
      'Em duas semanas, nenhum despacho bateu no limite de nenhuma assinatura. Sobra capacidade paga e não usada.',
    fazer:
      'É dinheiro parado: dá para mandar mais trabalho para essas assinaturas ou baixar o plano de uma delas.',
  },
  valor_baixo: {
    significa:
      'O placar que junta qualidade, economia e disponibilidade ficou abaixo da faixa saudável.',
    fazer: 'Costuma ser o eco dos outros alertas — resolva os de cima e este sobe junto.',
  },
  espera_merge_longa: {
    significa:
      'Metade dos PRs ficou pronta e aprovada pela máquina, apenas esperando alguém apertar o botão de juntar ao projeto.',
    fazer: 'É espera humana, não da máquina — costuma ser o trecho mais fácil de cortar.',
  },
  segmento_fila_ci: {
    significa:
      'A espera por uma máquina livre no GitHub, antes de os testes começarem, ficou bem acima do normal das últimas semanas.',
    fazer: 'Esse trecho não depende do nosso código. Se persistir, é fila do próprio GitHub.',
  },
  segmento_exec_ci: {
    significa:
      'Os testes automáticos passaram a demorar bem mais do que vinham demorando nas últimas semanas.',
    fazer:
      'É o trecho que dá para otimizar no repositório — a checagem provavelmente ficou pesada.',
  },
  segmento_espera_merge: {
    significa:
      'O tempo entre o PR ficar pronto e alguém juntá-lo ao projeto piorou em relação às últimas semanas.',
    fazer: 'É espera humana: juntar mais cedo o que já está verde resolve.',
  },
  segmento_deploy: {
    significa:
      'A publicação do site depois do merge ficou mais lenta que o normal das últimas semanas.',
    fazer: 'Vale olhar a etapa de publicação e o serviço que coloca o site no ar.',
  },
};

/** Cada limiar tem sua unidade — o número cru no banco não diz qual. */
function formatarValor(alerta: AlertaLinha): { valor: string; limiar: string } {
  const pct = (x: number) => `${Math.round(100 * x)}%`;
  switch (alerta.codigo) {
    case 'custo_alto':
      return {
        valor: `$${(alerta.valor ?? 0).toFixed(2)}`,
        limiar: `$${alerta.limiar.toFixed(2)}`,
      };
    case 'valor_baixo':
      return { valor: `${Math.round(alerta.valor ?? 0)}`, limiar: `${Math.round(alerta.limiar)}` };
    case 'espera_merge_longa':
    case 'segmento_fila_ci':
    case 'segmento_exec_ci':
    case 'segmento_espera_merge':
    case 'segmento_deploy':
      return { valor: formatarSegundos(alerta.valor), limiar: formatarSegundos(alerta.limiar) };
    default:
      return { valor: pct(alerta.valor ?? 0), limiar: pct(alerta.limiar) };
  }
}

/** "acima de"/"abaixo de": limiar de piso ou de teto muda a frase. */
const EH_PISO = new Set<CodigoAlerta>(['qualidade_baixa', 'valor_baixo']);

// O que a amostra conta muda com o limiar; os do GitHub caem no default.
const ROTULO_AMOSTRA: Partial<Record<CodigoAlerta, string>> = {
  qualidade_baixa: 'despachos julgados',
  retrabalho_alto: 'despachos julgados',
  custo_alto: 'tarefas entregues',
  quota_alta: 'despachos',
  quota_zerada: 'despachos',
  valor_baixo: 'despachos julgados',
};

const amostraDe = (codigo: CodigoAlerta): string => ROTULO_AMOSTRA[codigo] ?? 'execuções do GitHub';

const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const INFO_SECAO =
  'A cada 14 dias — e três dias antes de cada renovação de assinatura — o painel confere sozinho se algum número passou do limite combinado e registra o que encontrou. É a checagem que roda no servidor todo dia de madrugada; nada depende de o computador estar ligado.';

const INFO_REPETICAO =
  'Quantas das últimas checagens este mesmo ponto apareceu. Um aviso que aparece em toda checagem provavelmente não é novidade: ou a meta está desalinhada, ou é um problema de fundo que ninguém atacou ainda.';

export function FaixaAlertas({ historico }: { historico: HistoricoAlertas | undefined }) {
  const ultima = historico?.avaliacoes[0];
  // Antes da primeira avaliação a faixa simplesmente não existe — nada de
  // caixa vazia ocupando o topo do painel.
  if (!historico || !ultima) return null;

  const vigentes = historico.alertas.filter((a) => a.avaliacao_id === ultima.id);
  const totalAvaliacoes = historico.avaliacoes.length;

  /** Em quantas das últimas avaliações este mesmo limiar apareceu. */
  const repeticoes = (codigo: CodigoAlerta): number =>
    new Set(historico.alertas.filter((a) => a.codigo === codigo).map((a) => a.avaliacao_id)).size;

  return (
    <Secao
      titulo="Precisa da sua atenção"
      info={INFO_SECAO}
      subtitulo={`checado em ${dataBR(ultima.avaliado_em)}`}
      escopo={{ tipo: 'fixo', rotulo: 'a cada 14 dias' }}
    >
      {vigentes.length === 0 ? (
        <Card className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', corPill('good'))}
          >
            tudo dentro do combinado
          </span>
          <span className="text-sm text-text-primary">
            Nenhum número passou do limite na última checagem.
          </span>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {vigentes.map((alerta) => {
            const st: Status = alerta.severidade === 'critico' ? 'crit' : 'warn';
            const { valor, limiar } = formatarValor(alerta);
            const vezes = repeticoes(alerta.codigo);
            const sempre = totalAvaliacoes >= 3 && vezes === totalAvaliacoes;
            return (
              <Card key={alerta.id}>
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      corPill(st),
                    )}
                  >
                    {alerta.severidade === 'critico' ? 'passou muito' : 'passou do limite'}
                  </span>
                  <span className="text-sm font-bold text-text-primary">
                    {ROTULO_ALERTA[alerta.codigo]}
                  </span>
                  <span className="text-xs tabular-nums text-text-muted">
                    {valor} · {EH_PISO.has(alerta.codigo) ? 'combinado ≥' : 'combinado ≤'} {limiar}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-text-primary">
                  {TEXTO[alerta.codigo].significa}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  <span className="font-semibold">O que dá para fazer:</span>{' '}
                  {TEXTO[alerta.codigo].fazer}
                </p>
                <p className="mt-1.5 text-[11px] leading-snug text-text-muted">
                  <span className="tabular-nums">
                    apareceu em {vezes} de {totalAvaliacoes}{' '}
                    {totalAvaliacoes === 1 ? 'checagem' : 'checagens'}
                  </span>
                  <PopoverInfo texto={INFO_REPETICAO} label="entenda a repetição deste aviso" />
                  {sempre && ' · aparece sempre, não é novidade'}
                  {' · '}
                  <span className="tabular-nums">
                    calculado sobre {alerta.amostra} {amostraDe(alerta.codigo)}
                  </span>
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </Secao>
  );
}
