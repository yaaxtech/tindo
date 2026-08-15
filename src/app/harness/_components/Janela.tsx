import {
  estadoJanela,
  formatarAcimaTeto,
  formatarHoraColeta,
  formatarMedia,
  formatarMensagensEntreChats,
  formatarNumero,
  formatarPct,
  formatarTokens,
} from '@/lib/harness/janela';
import type { JanelaBlob, JanelaCampo } from '@/types/harness';
import { Card, PopoverInfo, Secao } from './ui';

const INFO_BLOCO =
  'Retrato do consumo de contexto das sessões do Claude: quanto do gasto é reler a conversa, quanto vai embora depois da chamada 200, e se os gestos de higiene (subagente, chip, compactar, mensagem entre chats) estão acontecendo. Snapshot calculado na máquina local e atualizado de hora em hora — não segue o filtro do painel.';
const COMO_PREFIXO =
  'Toda chamada ao modelo paga para ler a conversa inteira de novo. Este número mede quanto do gasto total foi só reler o que já estava escrito, em vez de trabalho novo. Alto é esperado — mas perto de 100% com sessões longas indica conversa inchada.';
const COMO_POS_200 =
  'Depois da chamada 200 a sessão já está longa demais e cada chamada custa caro. Este percentual é o gasto que aconteceu nesse trecho — é exatamente o que o corte de janela (compactar antes) economiza.';
const COMO_TETO =
  'Sessões que passaram de 200 chamadas sem compactar. Cada uma delas pagou o preço cheio de uma janela inchada até o fim.';
const COMO_TOKENS_TAREFA =
  'O total de tokens do período dividido pelo que foi entregue. Serve como régua no tempo: se as sessões ficarem mais curtas e os gestos de higiene subirem, este número tem que cair.';
const COMO_GESTOS =
  'Os gestos que mantêm a janela curta: subagente (manda parte do trabalho para um assistente separado, fora da conversa principal), chip, compactação (resumo da conversa antes de estourar o teto) e mensagem entre chats (uma janela pergunta para outra em vez de trazer todo o contexto de lá para cá). A média por sessão perto de zero quer dizer que ninguém está limpando a janela. Mensagem entre chats só passou a ser medida em 15/08 — coleta mais antiga aparece como "sem sinal", não como zero.';
const COMO_FAIXAS =
  'Sessões agrupadas pelo número de chamadas. A última coluna mostra a fatia do consumo total que cada grupo carrega — deixa óbvio que poucas sessões longas custam mais do que muitas curtas.';
const COMO_TOP =
  'As sessões mais caras do período, uma por linha: identificador curto, chamadas, tokens gastos e modelo. São as primeiras candidatas a investigar.';

function Kpi({
  titulo,
  valor,
  detalhe,
}: { titulo: string; valor: string; detalhe: React.ReactNode }) {
  return (
    <Card>
      <div className="text-xs font-semibold text-text-muted">{titulo}</div>
      <div className="my-1 text-2xl font-bold tabular-nums text-jade-accent sm:text-[28px]">
        {valor}
      </div>
      <div className="text-[11.5px] leading-snug text-text-muted">{detalhe}</div>
    </Card>
  );
}

function Corpo({ blob }: { blob: JanelaBlob }) {
  const { totais, kpis } = blob;
  const mensagens = formatarMensagensEntreChats(kpis.gestos, totais.sessoes);
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Kpi
          titulo="Releitura de prefixo"
          valor={formatarPct(kpis.pct_prefixo)}
          detalhe={
            <>
              do gasto é reler a conversa, não trabalho novo
              <PopoverInfo texto={COMO_PREFIXO} />
              <br />
              {formatarTokens(totais.cache_read)} de {formatarTokens(totais.tokens)} tokens
            </>
          }
        />
        <Kpi
          titulo="Desperdício pós-200"
          valor={formatarPct(kpis.pct_pos_200)}
          detalhe={
            <>
              gasto depois da chamada 200 — é o que o corte de janela economiza
              <PopoverInfo texto={COMO_POS_200} />
              <br />
              {formatarNumero(totais.sessoes)} sessões medidas
            </>
          }
        />
        <Kpi
          titulo="Sessões acima do teto"
          valor={formatarAcimaTeto(kpis.sessoes_acima_teto, totais.sessoes)}
          detalhe={
            <>
              passaram de {kpis.sessoes_acima_teto?.teto ?? 200} chamadas sem compactar
              <PopoverInfo texto={COMO_TETO} />
            </>
          }
        />
        <Kpi
          titulo="Tokens por tarefa"
          valor={formatarTokens(kpis.tokens_por_tarefa)}
          detalhe={
            <>
              custo de contexto de cada coisa entregue
              <PopoverInfo texto={COMO_TOKENS_TAREFA} />
              <br />
              sobre {formatarNumero(totais.sessoes)} sessões
            </>
          }
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
          <span className="text-text-secondary">
            Gestos de higiene
            <PopoverInfo texto={COMO_GESTOS} />
          </span>
          {kpis.gestos ? (
            <>
              <span className="font-bold tabular-nums text-text-primary">
                {formatarNumero(kpis.gestos.subagentes)} subagentes ·{' '}
                {formatarNumero(kpis.gestos.chips)} chips · {formatarNumero(kpis.gestos.compacts)}{' '}
                compacts
                {mensagens && <> · {mensagens.total} mensagens entre chats</>}
              </span>
              <span className="tabular-nums text-text-muted">
                (média de {formatarMedia(kpis.gestos.por_sessao)} por sessão)
              </span>
            </>
          ) : (
            <span className="tabular-nums text-text-muted">— · dado insuficiente</span>
          )}
        </div>
        {kpis.gestos && (
          <div className="mt-1 text-[11.5px] leading-snug text-text-muted">
            {mensagens ? (
              <>
                Mensagens entre chats: <span className="tabular-nums">{mensagens.alcance}</span>
              </>
            ) : (
              <>Mensagens entre chats: sem sinal nesta coleta — o gesto ainda não era medido.</>
            )}
          </div>
        )}
      </Card>

      <div className="overflow-x-auto rounded-xl border border-border-strong bg-bg-elevated">
        <table className="w-full border-collapse text-[12.5px] tabular-nums">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted">
              <th className="border-b border-border px-3 py-2 font-semibold whitespace-nowrap">
                Chamadas por sessão
                <PopoverInfo texto={COMO_FAIXAS} />
              </th>
              <th className="border-b border-border px-3 py-2 font-semibold whitespace-nowrap">
                Sessões
              </th>
              <th className="border-b border-border px-3 py-2 font-semibold whitespace-nowrap">
                % do consumo
              </th>
            </tr>
          </thead>
          <tbody>
            {blob.faixas.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-2 text-text-muted">
                  sem sessões no período
                </td>
              </tr>
            )}
            {blob.faixas.map((f) => (
              <tr key={f.faixa} className="last:[&>td]:border-b-0">
                <td className="whitespace-nowrap border-b border-border px-3 py-2">{f.faixa}</td>
                <td className="whitespace-nowrap border-b border-border px-3 py-2">
                  {formatarNumero(f.sessoes)}
                </td>
                <td className="whitespace-nowrap border-b border-border px-3 py-2">
                  {formatarPct(f.pct)}{' '}
                  <span className="text-text-muted">· {formatarTokens(f.tokens)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {blob.top_sessoes.length > 0 && (
        <Card>
          <div className="mb-2 text-xs font-semibold text-text-muted">
            Sessões mais caras
            <PopoverInfo texto={COMO_TOP} />
          </div>
          <div className="flex flex-col gap-1.5">
            {blob.top_sessoes.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] tabular-nums"
              >
                <span className="font-mono text-text-primary">{s.id}</span>
                <span className="text-text-muted">{s.modelo}</span>
                <span className="ml-auto text-text-muted">
                  {formatarNumero(s.chamadas)} chamadas ·{' '}
                  <b className="text-text-primary">{formatarTokens(s.tokens)}</b>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function Janela({ campo, id }: { campo: JanelaCampo | undefined; id?: string }) {
  const estado = estadoJanela(campo);

  return (
    <Secao
      id={id}
      titulo="Janela — consumo de contexto das sessões"
      info={INFO_BLOCO}
      escopo={{
        tipo: 'fixo',
        rotulo: estado.tipo === 'ok' ? `${estado.blob.dias} dias` : 'coleta horária',
      }}
    >
      {estado.tipo === 'ausente' && (
        <Card className="text-center">
          <p className="text-sm font-semibold text-text-primary">A coleta ainda não rodou</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-text-muted">
            A máquina local ainda não mediu o consumo de contexto das sessões. Este bloco aparece no
            próximo empurrão — até lá, nada de zeros nem números de outro período.
          </p>
        </Card>
      )}

      {estado.tipo === 'erro' && (
        <Card className="text-center">
          <p className="text-sm font-semibold text-text-primary">A coleta falhou</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-text-muted">
            A última medição ({formatarHoraColeta(estado.geradoEm)}) terminou em erro:{' '}
            {estado.mensagem}. Os números voltam no próximo empurrão bem-sucedido.
          </p>
        </Card>
      )}

      {estado.tipo === 'ok' && (
        <div className="space-y-2.5">
          {estado.velho && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Sem coleta desde {formatarHoraColeta(estado.geradoEm)} — os números abaixo são da
              última coleta, não de agora.
            </div>
          )}
          <Corpo blob={estado.blob} />
        </div>
      )}
    </Secao>
  );
}
