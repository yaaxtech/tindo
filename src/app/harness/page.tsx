'use client';

import { Assinaturas } from '@/app/harness/_components/Assinaturas';
import { Autonomia } from '@/app/harness/_components/Autonomia';
import { FiltroPeriodo } from '@/app/harness/_components/FiltroPeriodo';
import { FluxoGithub } from '@/app/harness/_components/FluxoGithub';
import { Modelos } from '@/app/harness/_components/Modelos';
import { PlacarValor } from '@/app/harness/_components/PlacarValor';
import { TemposGithub } from '@/app/harness/_components/TemposGithub';
import { Terrenos } from '@/app/harness/_components/Terrenos';
import { Tiles } from '@/app/harness/_components/Tiles';
import { Historico, VolumeCodigo } from '@/app/harness/_components/VolumeHistorico';
import { Secao } from '@/app/harness/_components/ui';
import { contarPendentes, diasComDados, kpisGerais, recorte } from '@/lib/harness/kpis';
import { getGithubRuns, getHarnessSnapshot } from '@/services/harness';
import type { GithubRunLinha, HarnessSnapshot } from '@/types/harness';
import { Gauge } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function HarnessPage() {
  const [snap, setSnap] = useState<HarnessSnapshot | null>(null);
  const [githubRuns, setGithubRuns] = useState<GithubRunLinha[] | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);
  const [janelaDias, setJanelaDias] = useState(7);

  useEffect(() => {
    void (async () => {
      setSnap(await getHarnessSnapshot());
      setCarregando(false);
    })();
    void (async () => {
      setGithubRuns(await getGithubRuns());
    })();
  }, []);

  const ledger = useMemo(() => snap?.dados.ledger ?? [], [snap]);
  const dias = useMemo(() => diasComDados(ledger), [ledger]);
  const atual = useMemo(() => recorte(ledger, janelaDias, 0), [ledger, janelaDias]);
  const anterior = useMemo(() => recorte(ledger, janelaDias, 1), [ledger, janelaDias]);
  const gAtual = useMemo(() => kpisGerais(atual), [atual]);
  const gAnterior = useMemo(() => kpisGerais(anterior), [anterior]);
  // Provisórios dos run.sh sem revisão: fora de todos os KPIs, só a contagem.
  const pendentes = useMemo(() => contarPendentes(atual), [atual]);

  const hora = snap
    ? new Date(snap.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;
  const totalMes = (snap?.dados.assinaturas ?? []).reduce((s, a) => s + a.valor, 0);

  return (
    <main className="min-h-dvh pb-16 safe-top safe-bottom">
      <header className="sticky top-0 z-10 border-b border-border bg-bg-deep/80 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Painel do Harness</h1>
            <p className="text-xs text-text-muted">
              {snap
                ? `KPIs dos últimos ${janelaDias} ${janelaDias === 1 ? 'dia' : 'dias'} (${gAtual.n} despachos)${pendentes > 0 ? ` · ⏳ ${pendentes} pendente${pendentes === 1 ? '' : 's'} de revisão (fora dos números)` : ''}${janelaDias > dias ? ` · só há ${dias}d de dados` : ''} · atualizado às ${hora}`
                : carregando
                  ? 'Carregando…'
                  : 'KPIs da orquestração multi-LLM'}
            </p>
          </div>
          {snap && (
            <FiltroPeriodo janelaDias={janelaDias} diasComDados={dias} onChange={setJanelaDias} />
          )}
        </div>
      </header>

      {!carregando && !snap && (
        <section className="mx-auto mt-16 w-full max-w-3xl px-6">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border-strong bg-bg-elevated p-10 text-center">
            <Gauge className="h-8 w-8 text-jade-accent" />
            <p className="text-sm font-semibold">Ainda sem dados</p>
            <p className="max-w-sm text-xs leading-relaxed text-text-muted">
              O painel acorda com o primeiro empurrão da máquina local. Assim que o ledger chegar ao
              Supabase, os seis blocos aparecem aqui — aguardando o primeiro empurrão.
            </p>
          </div>
        </section>
      )}

      {snap && (
        <div className="mx-auto mt-6 flex w-full max-w-3xl flex-col gap-9 px-6">
          {/* Bloco 1 — segue o filtro */}
          <Secao titulo="Como estamos" escopo={{ tipo: 'filtro', dias: janelaDias }}>
            <Tiles
              atual={gAtual}
              anterior={gAnterior}
              linhasAtual={atual}
              assinaturas={snap.dados.assinaturas}
              janelaDias={janelaDias}
            />
          </Secao>

          {/* Bloco 2 — segue o filtro */}
          <Secao
            titulo="Placar de Valor"
            info="Um número de 0 a 100 que junta qualidade, economia e disponibilidade das tarefas reais do harness."
            escopo={{ tipo: 'filtro', dias: janelaDias }}
          >
            <PlacarValor
              linhas={atual}
              assinaturas={snap.dados.assinaturas}
              janelaDias={janelaDias}
            />
          </Secao>

          {/* Bloco 2.5 — segue o filtro; some quando o coletor ainda não subiu */}
          {snap.dados.autonomia && (
            <Secao
              titulo="Autonomia — quanto eu te interrompo"
              info="Quantas vezes o assistente parou o trabalho para te perguntar algo, e o que aconteceu com cada pergunta. Aceite alto = pergunta que não precisava existir. Correção alta = pergunta que valeu. Sai do histórico das sessões, atualizado junto com o resto do painel."
              escopo={{ tipo: 'filtro', dias: janelaDias }}
            >
              <Autonomia autonomia={snap.dados.autonomia} janelaDias={janelaDias} />
            </Secao>
          )}

          {/* Bloco 3 — semanal fixo, não segue o filtro */}
          <Secao titulo="Fluxo de entrega (GitHub)" escopo={{ tipo: 'fixo', rotulo: 'semanal' }}>
            <FluxoGithub prs={snap.dados.prs} gerais={gAtual} />
          </Secao>

          {/* Bloco 4 — semanal fixo, independente do filtro */}
          <TemposGithub runs={githubRuns} />

          {/* Bloco 5 — segue o filtro */}
          <Secao
            titulo="Por terreno — modelo titular, fallback e sinal"
            escopo={{ tipo: 'filtro', dias: janelaDias }}
          >
            <Terrenos linhas={atual} cadeias={snap.dados.cadeias} />
            <p className="mt-2.5 text-xs leading-relaxed text-text-muted">
              ▲ subir modelo = está errando demais, precisa de um mais inteligente · ▼ pode baratear
              = acerta tanto que vale testar um mais barato · ‖ saturada = bateu o limite da
              assinatura, desviar antes do erro · … pouco dado = ainda sem amostra pra julgar
            </p>
          </Secao>

          {/* Bloco 6 — segue o filtro */}
          <Secao
            titulo="Chamadas por modelo"
            info='Quantas vezes cada modelo foi acionado, separado por nível de esforço (ex.: Luna no max, Luna no low, Sonnet no medium). "ok" = quanto ele acertou de primeira. Mostra onde o trabalho está de fato caindo e se o modelo certo está sendo usado para cada peso.'
            escopo={{ tipo: 'filtro', dias: janelaDias }}
          >
            <Modelos linhas={atual} />
          </Secao>

          {/* Bloco 7 — segue o filtro */}
          <Secao
            titulo={`Assinaturas — $${totalMes}/mês`}
            info="Cada card mostra o custo por tarefa daquela assinatura no período (valor mensal proporcional aos dias, dividido pelas tarefas que ela executou). O veredito traduz isso em decisão: rende bem = manter; sem uso = candidata a cancelar; custo alto = observar; saturada = está batendo no limite, candidata a aumentar. A decisão real sai do histórico na data de renovação, nunca de um dia só."
            escopo={{ tipo: 'filtro', dias: janelaDias }}
          >
            <Assinaturas
              linhas={atual}
              assinaturas={snap.dados.assinaturas}
              janelaDias={janelaDias}
            />
            <p className="mt-2.5 text-xs leading-relaxed text-text-muted">
              Custo por tarefa = quanto cada assinatura custou por tarefa que executou no período.
              Barato + saturada = aumentar; caro + parada = cancelar. Decisão final nas datas de
              renovação.
            </p>
          </Secao>

          {/* Bloco 8 — fixos */}
          <Secao
            titulo="Volume de código — linhas alteradas por semana"
            info="Soma das linhas adicionadas e removidas nos commits de cada semana, direto do git (lockfiles e arquivos gerados ficam de fora). Mede o VOLUME de desenvolvimento — lido junto com a Qualidade: volume alto com qualidade alta = harness rendendo."
            escopo={{ tipo: 'fixo', rotulo: '4 semanas' }}
          >
            <VolumeCodigo volume={snap.dados.volume_codigo} />
          </Secao>

          <Secao
            titulo="Histórico dos KPIs"
            info="Foto semanal dos 5 números de cima. É esta tabela que mostra se o harness está melhorando no tempo — e é dela que saem as decisões de assinatura nas datas de renovação."
            escopo={{ tipo: 'fixo', rotulo: 'snapshots' }}
          >
            <Historico history={snap.dados.history} totalMes={totalMes} />
          </Secao>
        </div>
      )}
    </main>
  );
}
