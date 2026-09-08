'use client';

import { Assinaturas } from '@/app/harness/_components/Assinaturas';
import { Autonomia } from '@/app/harness/_components/Autonomia';
import { Experimentos } from '@/app/harness/_components/Experimentos';
import { FaixaAlertas } from '@/app/harness/_components/FaixaAlertas';
import { FiltroPeriodo } from '@/app/harness/_components/FiltroPeriodo';
import { FluxoGithub } from '@/app/harness/_components/FluxoGithub';
import { Janela } from '@/app/harness/_components/Janela';
import { MinutosGithub } from '@/app/harness/_components/MinutosGithub';
import { Modelos } from '@/app/harness/_components/Modelos';
import { NavPainel } from '@/app/harness/_components/NavPainel';
import { PlacarValor } from '@/app/harness/_components/PlacarValor';
import { Resumo } from '@/app/harness/_components/Resumo';
import { Revisao } from '@/app/harness/_components/Revisao';
import { SaudeDados } from '@/app/harness/_components/SaudeDados';
import { TemposDespacho } from '@/app/harness/_components/TemposDespacho';
import { TemposGithub } from '@/app/harness/_components/TemposGithub';
import { Terrenos } from '@/app/harness/_components/Terrenos';
import { Tiles } from '@/app/harness/_components/Tiles';
import { Historico, VolumeCodigo } from '@/app/harness/_components/VolumeHistorico';
import { IDS_DIAGNOSTICO, SECOES_PAINEL } from '@/app/harness/_components/secoes';
import { Secao } from '@/app/harness/_components/ui';
import { useDadosHarness } from '@/app/harness/_components/useDadosHarness';
import { avaliarLedger } from '@/lib/harness/alertas';
import { carimboAtualizacao } from '@/lib/harness/atualizacao';
import {
  aplicarMetricasPublicadas,
  contarInfra,
  contarPendentes,
  contratoMetricasValido,
  diasComDados,
  filtrarHistoricoCompativel,
  kpisGerais,
  recorte,
} from '@/lib/harness/kpis';
import { cn } from '@/lib/utils';
import { Gauge, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

/** Texto único dos blocos decisórios quando o snapshot não cumpre o contrato. */
const INDICADORES_INDISPONIVEIS =
  'Indicadores indisponíveis: o snapshot não cumpre o contrato de métricas. Nenhum número deste bloco é mostrado até chegar uma leitura íntegra.';

export default function HarnessPage() {
  const { snap, githubRuns, actionsSnapshot, alertas, carregando, erro, atualizar } =
    useDadosHarness();
  const [janelaDias, setJanelaDias] = useState(7);

  // Disclosure do diagnóstico: fechado por padrão, abre se a URL já chegou
  // apontando para um bloco de dentro (link compartilhado, recarregar a página).
  // A NavPainel também abre pelo DOM ao clicar num item; o `onToggle` traz
  // esse estado de volta para cá.
  const [diagnosticoAberto, setDiagnosticoAberto] = useState(false);
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && IDS_DIAGNOSTICO.has(hash)) setDiagnosticoAberto(true);
  }, []);

  const ledger = useMemo(() => snap?.dados.ledger ?? [], [snap]);
  const contratoValido = useMemo(() => (snap ? contratoMetricasValido(snap.dados) : false), [snap]);
  const historicoCompativel = useMemo(
    () => (contratoValido ? filtrarHistoricoCompativel(snap?.dados.history ?? []) : []),
    [snap, contratoValido],
  );
  const asOf = snap?.dados.as_of ?? snap?.geradoEm;
  const asOfMs = useMemo(() => {
    const valor = asOf ? Date.parse(asOf) : Number.NaN;
    return Number.isFinite(valor) ? valor : Date.now();
  }, [asOf]);
  const dias = useMemo(() => diasComDados(ledger, asOfMs), [ledger, asOfMs]);
  const atual = useMemo(() => recorte(ledger, janelaDias, 0, asOfMs), [ledger, janelaDias, asOfMs]);
  const anterior = useMemo(
    () => recorte(ledger, janelaDias, 1, asOfMs),
    [ledger, janelaDias, asOfMs],
  );
  const publicadas = snap?.dados.metricas_periodos?.[String(janelaDias)];
  const linhasDecisorias = useMemo(() => (contratoValido ? atual : []), [contratoValido, atual]);
  const gAtual = useMemo(
    () =>
      aplicarMetricasPublicadas(
        kpisGerais(linhasDecisorias),
        contratoValido ? publicadas?.atual.construcao : null,
      ),
    [linhasDecisorias, contratoValido, publicadas],
  );
  const gAnterior = useMemo(
    () =>
      aplicarMetricasPublicadas(
        kpisGerais(contratoValido ? anterior : []),
        contratoValido ? publicadas?.anterior.construcao : null,
      ),
    [anterior, contratoValido, publicadas],
  );
  // Provisórios dos run.sh sem revisão: fora de todos os KPIs, só a contagem.
  const pendentes = useMemo(() => contarPendentes(atual), [atual]);
  const infra = useMemo(() => contarInfra(atual), [atual]);
  // Reconferência da faixa de alerta: o revisor grava o veredicto de 14 em 14
  // dias, então um alerta pode estar congelado num cálculo que já mudou. Mesma
  // função que o cron usa — nenhuma fórmula nova aqui. Usa a janela FIXA do
  // revisor (14 dias), não o filtro de período da tela.
  const violacoesAgora = useMemo(
    () => (contratoValido ? avaliarLedger(ledger, snap?.dados.assinaturas ?? [], asOfMs) : []),
    [ledger, snap, asOfMs, contratoValido],
  );
  const amostraAlertas = useMemo(
    () => (contratoValido ? kpisGerais(recorte(ledger, 14, 0, asOfMs)).julg : 0),
    [ledger, asOfMs, contratoValido],
  );

  // O painel fica aberto por horas seguidas: sem este tique, o "há 30 min"
  // congelaria no valor da primeira pintura e mentiria a tarde inteira.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30e3);
    return () => clearInterval(id);
  }, []);

  const carimbo = snap ? carimboAtualizacao(snap.geradoEm, agora) : null;
  const totalMes = (snap?.dados.assinaturas ?? []).reduce((s, a) => s + a.valor, 0);

  return (
    <main className="min-h-dvh pb-16 safe-top safe-bottom">
      {/* Cabeçalho e navegação grudam JUNTOS, num único container sticky. A nav
          já tentou se posicionar medindo a altura do header por JS e ficava
          presa no valor da 1ª pintura — se a janela mudasse de tamanho depois,
          a barra flutuava fora do lugar. Com um container só, quem resolve é o
          CSS, que nunca fica desatualizado. */}
      {/* O fundo fica no container, não nas duas barras — assim as duas
          compartilham um único plano translúcido, sem somar opacidade na
          divisa. O `/80` funciona desde que os tokens viraram canais RGB
          (PR #58); antes disso resolvia para rgba(0,0,0,0) e esta barra
          precisava de fundo 100% opaco como contorno. */}
      <div className="sticky top-[var(--app-header-h)] z-10 bg-bg-deep/80 backdrop-blur-xl">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-4">
            <div className="flex-1">
              <h1 className="text-lg font-semibold">Painel do Harness</h1>
              <p className="text-xs text-text-muted">
                {snap && !contratoValido
                  ? `Leitura incompatível — indicadores suspensos${carimbo ? ` · ${carimbo}` : ''}`
                  : snap
                    ? `KPIs dos últimos ${janelaDias} ${janelaDias === 1 ? 'dia' : 'dias'} (${gAtual.n} despachos)${pendentes > 0 ? ` · ⏳ ${pendentes} pendente${pendentes === 1 ? '' : 's'} de revisão (fora dos números)` : ''}${infra > 0 ? ` · ${infra} nunca ${infra === 1 ? 'rodou' : 'rodaram'} (infra)` : ''}${janelaDias > dias ? ` · só há ${dias}d de dados` : ''}${carimbo ? ` · ${carimbo}` : ''}`
                    : carregando
                      ? 'Carregando…'
                      : 'KPIs da orquestração multi-LLM'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void atualizar()}
              disabled={carregando}
              aria-busy={carregando}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors',
                'hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent/40',
                'disabled:cursor-wait disabled:opacity-60',
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} aria-hidden />
              {carregando ? 'Atualizando…' : 'Atualizar'}
            </button>
            {snap && (
              <FiltroPeriodo janelaDias={janelaDias} diasComDados={dias} onChange={setJanelaDias} />
            )}
          </div>
          {erro && (
            <p role="alert" className="mx-auto mt-2 w-full max-w-3xl text-xs text-warning">
              {erro}
            </p>
          )}
        </header>

        {snap && <NavPainel grupos={SECOES_PAINEL} />}
      </div>

      {/* Sem snapshot: o serviço distingue banco vazio (null) de erro (rejeita),
          então este bloco só afirma "sem dados" quando é isso mesmo. */}
      {!carregando && !snap && (
        <section className="mx-auto mt-16 w-full max-w-3xl px-6">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border-strong bg-bg-elevated p-10 text-center">
            <Gauge className="h-8 w-8 text-jade-accent" />
            <p className="text-sm font-semibold">{erro ? 'Sem leitura' : 'Ainda sem dados'}</p>
            <p className="max-w-sm text-xs leading-relaxed text-text-muted">
              {erro
                ? 'A leitura do snapshot falhou e não há uma anterior para mostrar. Use Atualizar para tentar de novo.'
                : 'O painel acorda com o primeiro empurrão da máquina local. Assim que o ledger chegar ao Supabase, os blocos aparecem aqui.'}
            </p>
          </div>
        </section>
      )}

      {snap && (
        <div className="mx-auto mt-6 flex w-full max-w-3xl flex-col gap-9 px-6">
          {/* Snapshot fora do contrato: aviso SEMPRE à vista, fora do
              diagnóstico fechado. Sem ele, "0 despachos" pareceria dado real. */}
          {!contratoValido && (
            <p
              role="alert"
              className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm leading-relaxed text-warning"
            >
              Snapshot incompatível com o contrato de métricas: os indicadores ficam suspensos até
              chegar uma leitura íntegra e versionada. Nada abaixo é dado real deste período; o
              detalhe está em “Saúde dos dados”.
            </p>
          )}

          {/* Abertura — quem faz o quê. Texto fixo, decisão do dono. */}
          <Secao
            id="resumo"
            titulo="Resumo — quem faz o quê"
            info="Divisão de papéis decidida pelo dono. O que cada modelo de fato executou está nos registros do ledger, não nesta configuração."
          >
            <Resumo />
          </Secao>

          {/* Faixa de alerta — o que o revisor de KPIs achou na última checagem.
              Só aparece depois da primeira avaliação. */}
          <FaixaAlertas
            historico={alertas}
            violacoesAgora={violacoesAgora}
            amostraLedger={amostraAlertas}
          />

          {/* Bloco 1 — segue o filtro */}
          <Secao
            id="visao-geral"
            titulo="Como estamos"
            escopo={{ tipo: 'filtro', dias: janelaDias }}
          >
            {contratoValido ? (
              <Tiles
                atual={gAtual}
                anterior={gAnterior}
                linhasAtual={linhasDecisorias}
                assinaturas={snap.dados.assinaturas}
                janelaDias={janelaDias}
              />
            ) : (
              <p className="text-sm text-text-muted">{INDICADORES_INDISPONIVEIS}</p>
            )}
          </Secao>

          {/* Bloco 2 — segue o filtro */}
          <Secao
            id="placar"
            titulo="Placar de Valor"
            info="Um número de 0 a 100 que junta qualidade, economia e disponibilidade das tarefas reais do harness."
            escopo={{ tipo: 'filtro', dias: janelaDias }}
          >
            {contratoValido ? (
              <PlacarValor
                linhas={linhasDecisorias}
                assinaturas={snap.dados.assinaturas}
                janelaDias={janelaDias}
              />
            ) : (
              <p className="text-sm text-text-muted">{INDICADORES_INDISPONIVEIS}</p>
            )}
          </Secao>

          {/* Bloco 3 — configuração atual por terreno; segue o filtro */}
          <Secao
            id="terrenos"
            titulo="Configuração atual por terreno — titular, fallback e sinal"
            escopo={{ tipo: 'filtro', dias: janelaDias }}
          >
            <Terrenos linhas={linhasDecisorias} cadeias={snap.dados.cadeias} />
            {!contratoValido && (
              <p className="mt-2.5 text-xs text-warning">
                Só a configuração declarada; os sinais ficam em “pouco dado” porque a leitura está
                suspensa.
              </p>
            )}
            <p className="mt-2.5 text-xs leading-relaxed text-text-muted">
              ▲ subir modelo = está errando demais, precisa de um mais inteligente · ▼ pode baratear
              = acerta tanto que vale testar um mais barato · ‖ saturada = bateu o limite da
              assinatura, desviar antes do erro · … pouco dado = ainda sem amostra pra julgar
            </p>
          </Secao>

          {/* Bloco 4 — assinaturas; segue o filtro */}
          <Secao
            id="assinaturas"
            titulo={`Assinaturas — referência $${totalMes}/mês`}
            info="Valores de referência dos planos atuais, como vêm do snapshot — não é fatura. Cada card mostra um custo rateado estimado por tarefa no período (valor de referência proporcional aos dias, dividido pelas tarefas que a assinatura executou). A etiqueta resume o período: rende bem, sem uso, custo alto ou saturada. Nenhuma decisão é automática — cancelar, manter ou ampliar é escolha do dono na renovação, com o histórico na mão."
            escopo={{ tipo: 'filtro', dias: janelaDias }}
          >
            {contratoValido ? (
              <Assinaturas
                linhas={linhasDecisorias}
                assinaturas={snap.dados.assinaturas}
                janelaDias={janelaDias}
              />
            ) : (
              <p className="text-sm text-text-muted">
                Leitura de assinaturas suspensa até chegar um snapshot íntegro e compatível.
              </p>
            )}
            <p className="mt-2.5 text-xs leading-relaxed text-text-muted">
              Valores são a referência dos planos atuais, não fatura; o custo por tarefa é um rateio
              estimado, não economia realizada. “Saturada” conta despachos barrados por quota nos
              registros; o uso do plano (saldo) não é medido pelo painel. Datas de renovação vêm do
              snapshot, e aparecem como “não informada” quando o gerador não as publica.
            </p>
          </Secao>

          {/* Bloco 5 — experimentos A/B do plano; candidatos fixos, sem vencedor.
              Não depende do filtro: nada aqui vem do ledger. */}
          <Secao
            id="experimentos"
            titulo="Experimentos A/B"
            info="Comparações previstas no plano do dono. O painel só lista os candidatos e o status do piloto, que roda fora dele em recibos separados. Registros históricos do ledger não são resultados pareados e não são contados aqui; a promoção depende dos critérios do teste."
            escopo={{ tipo: 'fixo', rotulo: 'plano' }}
          >
            <Experimentos />
          </Secao>

          {/* Diagnóstico detalhado — tudo que é longo fica atrás deste
              disclosure. Os ids continuam existindo: a NavPainel abre o
              <details> antes de rolar, e a URL com #id abre no carregamento. */}
          <details
            id="diagnostico"
            open={diagnosticoAberto}
            onToggle={(e) => setDiagnosticoAberto(e.currentTarget.open)}
            className="group rounded-xl border border-border-strong bg-bg-elevated/60"
          >
            <summary className="cursor-pointer select-none rounded-xl px-4 py-3 text-sm font-semibold text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent/40">
              <span className="group-open:hidden">Ver diagnóstico detalhado</span>
              <span className="hidden group-open:inline">Ocultar diagnóstico detalhado</span>
              <span className="ml-2 text-xs font-normal text-text-muted">
                saúde dos dados, autonomia, contexto, revisões, tempos, GitHub, modelos, volume e
                histórico
              </span>
            </summary>
            <div className="flex flex-col gap-9 border-t border-border px-4 pb-6 pt-6">
              <Secao
                id="saude-dados"
                titulo="Saúde dos dados"
                info="Mostra se o painel está atualizado e quanto da telemetria tem os campos necessários para uma leitura confiável. A cobertura é fixa nos 90 dias publicados."
                escopo={{ tipo: 'fixo', rotulo: '90 dias' }}
              >
                <SaudeDados dados={snap.dados} contratoValido={contratoValido} />
              </Secao>

              {snap.dados.autonomia && (
                <Secao
                  id="autonomia"
                  titulo="Autonomia — quanto eu te interrompo"
                  info="Quantas vezes o assistente parou o trabalho para te perguntar algo, e o que aconteceu com cada pergunta. Aceite alto = pergunta que não precisava existir. Correção alta = pergunta que valeu. Sai do histórico das sessões, atualizado junto com o resto do painel."
                  escopo={{ tipo: 'filtro', dias: janelaDias }}
                >
                  <Autonomia autonomia={snap.dados.autonomia} janelaDias={janelaDias} />
                </Secao>
              )}

              {/* Snapshot horário fixo, não segue o filtro */}
              <Janela id="janela" campo={snap.dados.janela} />

              <Secao
                id="revisao"
                titulo="Revisão — problemas encontrados"
                info="Métrica separada da construção. Ela mede quantas revisões carimbadas encontraram algo para corrigir; nunca entra como retrabalho do modelo construtor."
                escopo={{ tipo: 'filtro', dias: janelaDias }}
              >
                <Revisao linhas={linhasDecisorias} />
              </Secao>

              <TemposDespacho
                id="tempo-despacho"
                linhas={linhasDecisorias}
                janelaDias={janelaDias}
              />

              {/* Semanal fixo, independente do filtro */}
              <TemposGithub id="tempo-entrega" runs={githubRuns} />

              <Secao
                id="fluxo"
                titulo="Fluxo de entrega (GitHub)"
                escopo={{ tipo: 'fixo', rotulo: 'semanal' }}
              >
                <FluxoGithub prs={snap.dados.prs} gerais={gAtual} />
              </Secao>

              {/* Ciclo mensal fixo */}
              <MinutosGithub id="minutos-github" snapshot={actionsSnapshot} />

              <Secao
                id="modelos"
                titulo="Chamadas por modelo"
                info='Quantas vezes cada modelo foi acionado, separado por nível de esforço (ex.: Luna no max, Luna no low, Sonnet no medium). "ok" = quanto ele acertou de primeira. Mostra onde o trabalho está de fato caindo e se o modelo certo está sendo usado para cada peso.'
                escopo={{ tipo: 'filtro', dias: janelaDias }}
              >
                <Modelos linhas={linhasDecisorias} />
              </Secao>

              <Secao
                id="volume"
                titulo="Volume de código — linhas alteradas por semana"
                info="Soma das linhas adicionadas e removidas nos commits de cada semana, direto do git (lockfiles e arquivos gerados ficam de fora). Mede o VOLUME de desenvolvimento — lido junto com a Qualidade: volume alto com qualidade alta = harness rendendo."
                escopo={{ tipo: 'fixo', rotulo: '4 semanas' }}
              >
                <VolumeCodigo volume={snap.dados.volume_codigo} />
              </Secao>

              <Secao
                id="historico-kpis"
                titulo="Histórico dos KPIs"
                info="Foto semanal dos 5 números de cima. É esta tabela que mostra se o harness está melhorando no tempo — é com ela na mão que o dono decide as assinaturas nas datas de renovação."
                escopo={{ tipo: 'fixo', rotulo: 'snapshots' }}
              >
                <Historico history={historicoCompativel} totalMes={totalMes} />
              </Secao>
            </div>
          </details>
        </div>
      )}
    </main>
  );
}
