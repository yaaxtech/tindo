'use client';

import { cn } from '@/lib/utils';
import type { KpiAdiamento, KpisAdiamento } from '@/services/kpis-adiamento';
import { CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Timer, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Config dos 5 KPIs — cópia em pt-BR humana, sem jargão
// ---------------------------------------------------------------------------

type SentidoMeta = 'menor-melhor' | 'maior-melhor';

interface KpiDef {
  sigla: 'TRA' | 'TCA' | 'TEX' | 'MAC' | 'SAE';
  chave: keyof Pick<KpisAdiamento, 'tra' | 'tca' | 'tex' | 'mac' | 'sae'>;
  nome: string;
  resumo: string;
  descricao: string;
  unidade: 'percentual' | 'numero';
  sentido: SentidoMeta;
  rotuloMeta: string;
  rotuloAmostras: (n: number) => string;
}

const KPIS: KpiDef[] = [
  {
    sigla: 'TRA',
    chave: 'tra',
    nome: 'Voltou e adiou de novo',
    resumo: 'Das tarefas que o app adiou sozinho, quantas foram adiadas de novo quando voltaram.',
    descricao:
      'Quando o TinDo adia uma tarefa por você, ela volta depois. Este número diz quantas dessas você empurrou mais uma vez, em vez de concluir.',
    unidade: 'percentual',
    sentido: 'menor-melhor',
    rotuloMeta: 'ideal ficar abaixo de 25%',
    rotuloAmostras: (n) =>
      n === 1 ? '1 adiamento automático analisado' : `${n} adiamentos automáticos analisados`,
  },
  {
    sigla: 'TCA',
    chave: 'tca',
    nome: 'Voltou e concluiu',
    resumo: 'Das tarefas que o app adiou sozinho, quantas você de fato concluiu quando voltaram.',
    descricao:
      'É o lado positivo do TRA. Quanto maior, melhor — significa que o adiamento automático está trazendo a tarefa no momento certo pra você finalizar.',
    unidade: 'percentual',
    sentido: 'maior-melhor',
    rotuloMeta: 'ideal ficar acima de 50%',
    rotuloAmostras: (n) =>
      n === 1 ? '1 adiamento automático analisado' : `${n} adiamentos automáticos analisados`,
  },
  {
    sigla: 'TEX',
    chave: 'tex',
    nome: 'Passou do prazo',
    resumo: 'Das tarefas adiadas com prazo, quantas ficaram agendadas depois da data-limite.',
    descricao:
      'Quando você adia uma tarefa que tem prazo, o app tenta respeitar a data. Este número mostra quantas acabaram ultrapassando — um sinal de que o prazo está muito apertado ou que vale reconsiderar.',
    unidade: 'percentual',
    sentido: 'menor-melhor',
    rotuloMeta: 'ideal ficar abaixo de 5%',
    rotuloAmostras: (n) =>
      n === 1 ? '1 tarefa com prazo analisada' : `${n} tarefas com prazo analisadas`,
  },
  {
    sigla: 'MAC',
    chave: 'mac',
    nome: 'Adiamentos por tarefa',
    resumo: 'Em média, quantas vezes você adia uma tarefa antes de concluí-la.',
    descricao:
      'A mediana de adiamentos nas tarefas que você fechou. Três ou menos é saudável — acima disso, talvez esteja adiando o que merece ser feito ou descartado.',
    unidade: 'numero',
    sentido: 'menor-melhor',
    rotuloMeta: 'ideal ficar em 3 ou menos',
    rotuloAmostras: (n) => (n === 1 ? '1 tarefa concluída' : `${n} tarefas concluídas`),
  },
  {
    sigla: 'SAE',
    chave: 'sae',
    nome: 'Importantes escapando',
    resumo: 'Das tarefas com nota alta, quantas você adiou mais de duas vezes sem concluir.',
    descricao:
      'Tarefas com nota 90+ que ficaram paradas após três ou mais adiamentos. Quando esse número sobe, o app pode estar deixando escapar o que mais importa — hora de revisar a fila.',
    unidade: 'percentual',
    sentido: 'menor-melhor',
    rotuloMeta: 'ideal ficar próximo de 0%',
    rotuloAmostras: (n) =>
      n === 1 ? '1 tarefa nota alta pendente' : `${n} tarefas nota alta pendentes`,
  },
];

// ---------------------------------------------------------------------------
// Helpers de formatação / severidade
// ---------------------------------------------------------------------------

function formatarValor(kpi: KpiAdiamento, unidade: KpiDef['unidade']): string {
  if (kpi.amostras === 0) return '—';
  if (unidade === 'numero') {
    // mediana pode ser fracionária (ex: 2.5) — 1 casa
    return Number.isInteger(kpi.valor) ? String(kpi.valor) : kpi.valor.toFixed(1);
  }
  return `${kpi.valor.toFixed(kpi.valor < 10 ? 1 : 0)}`;
}

type Severidade = 'ok' | 'warn' | 'danger' | 'neutro';

/**
 * Severidade do desvio da meta.
 * - Dentro da meta → ok
 * - Fora por pouco (≤ 50% do limiar de tolerância) → warn
 * - Muito fora → danger
 * - Sem amostras → neutro
 */
function calcularSeveridade(kpi: KpiAdiamento, def: KpiDef): Severidade {
  if (kpi.amostras === 0) return 'neutro';
  if (kpi.dentroDaMeta) return 'ok';

  const desvioRelativo =
    def.sentido === 'menor-melhor'
      ? (kpi.valor - kpi.meta) / Math.max(1, kpi.meta)
      : (kpi.meta - kpi.valor) / Math.max(1, kpi.meta);

  // Até 50% de desvio → warn; acima → danger
  return desvioRelativo > 0.5 ? 'danger' : 'warn';
}

const CORES_SEVERIDADE: Record<
  Severidade,
  { anel: string; borda: string; texto: string; bg: string; pontoBg: string }
> = {
  ok: {
    anel: 'var(--jade-accent)',
    borda: 'border-jade-accent/40',
    texto: 'text-jade-accent',
    bg: 'bg-jade-accent/10',
    pontoBg: 'bg-jade-accent',
  },
  warn: {
    anel: 'var(--warning)',
    borda: 'border-warning/40',
    texto: 'text-warning',
    bg: 'bg-warning/10',
    pontoBg: 'bg-warning',
  },
  danger: {
    anel: 'var(--danger)',
    borda: 'border-danger/40',
    texto: 'text-danger',
    bg: 'bg-danger/10',
    pontoBg: 'bg-danger',
  },
  neutro: {
    anel: 'var(--text-muted)',
    borda: 'border-border-strong',
    texto: 'text-text-muted',
    bg: 'bg-bg-surface',
    pontoBg: 'bg-text-muted',
  },
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

type Janela = 7 | 30 | 90;

export function AdiamentoTab() {
  const [janela, setJanela] = useState<Janela>(30);
  const [kpis, setKpis] = useState<KpisAdiamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [glossarioAberto, setGlossarioAberto] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    void (async () => {
      try {
        const res = await fetch(`/api/gamificacao/kpis-adiamento?janela=${janela}`);
        if (!res.ok) throw new Error('Não conseguimos carregar os dados agora.');
        const body = (await res.json()) as KpisAdiamento;
        if (!cancelado) setKpis(body);
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro inesperado.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [janela]);

  const resumo = kpis ? construirResumo(kpis) : null;

  return (
    <div className="space-y-6">
      {/* Cabeçalho: resumo + seletor de janela */}
      <div className="rounded-xl border border-border-strong bg-bg-elevated p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Como está seu adiamento</h2>
            <p className="mt-1 text-xs text-text-secondary">
              {resumo?.mensagem ??
                (carregando
                  ? 'Calculando seus números…'
                  : 'Os 5 sinais que mostram se o app está adiando bem pra você.')}
            </p>
          </div>

          <SeletorJanela janela={janela} onChange={setJanela} />
        </div>

        {resumo && (
          <div className="mt-4 flex items-center gap-2">
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-bg-surface">
              <div
                className="h-full grad-jade transition-all duration-500"
                style={{ width: `${(resumo.dentroMeta / resumo.total) * 100}%` }}
              />
            </div>
            <span className="font-mono text-xs tabular-nums text-text-secondary">
              {resumo.dentroMeta}/{resumo.total}
            </span>
          </div>
        )}
      </div>

      {/* Grid de KPIs */}
      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : carregando ? (
        <GridSkeletons />
      ) : kpis ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {KPIS.map((def, idx) => (
            <KpiTile key={def.sigla} def={def} kpi={kpis[def.chave]} delayMs={idx * 50} />
          ))}
        </div>
      ) : null}

      {/* Glossário — educação do usuário */}
      <section className="rounded-xl border border-border-strong bg-bg-elevated">
        <button
          type="button"
          onClick={() => setGlossarioAberto((v) => !v)}
          aria-expanded={glossarioAberto}
          className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold hover:bg-bg-hover/40"
        >
          <span>O que cada número quer dizer</span>
          {glossarioAberto ? (
            <ChevronUp className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          )}
        </button>
        {glossarioAberto && (
          <div className="space-y-4 border-t border-border px-5 py-4">
            {KPIS.map((def) => (
              <div key={def.sigla}>
                <p className="flex items-center gap-2 text-xs">
                  <span className="rounded-sm bg-bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                    {def.sigla}
                  </span>
                  <span className="font-medium text-text-primary">{def.nome}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{def.descricao}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tile individual de KPI
// ---------------------------------------------------------------------------

function KpiTile({
  def,
  kpi,
  delayMs,
}: {
  def: KpiDef;
  kpi: KpiAdiamento;
  delayMs: number;
}) {
  const sev = calcularSeveridade(kpi, def);
  const cores = CORES_SEVERIDADE[sev];
  const valor = formatarValor(kpi, def.unidade);
  const semDados = kpi.amostras === 0;

  return (
    <article
      aria-label={`${def.nome}: ${valor}${def.unidade === 'percentual' ? '%' : ''}. ${def.rotuloMeta}. Situação: ${descreverSituacao(sev)}.`}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border bg-bg-elevated p-5',
        'opacity-0 animate-[fadeInScale_320ms_cubic-bezier(0,0,0.2,1)_forwards]',
        sev === 'ok' ? 'border-jade-accent/30' : 'border-border-strong',
        'transition-colors hover:border-border-strong/80',
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {/* Header: sigla + indicador */}
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
              semDados ? 'bg-bg-surface text-text-muted' : `${cores.bg} ${cores.texto}`,
            )}
          >
            {def.sigla}
          </span>
          <IndicadorSeveridade severidade={sev} />
        </div>
      </header>

      {/* Nome + resumo */}
      <div>
        <h3 className="text-sm font-semibold leading-tight text-text-primary">{def.nome}</h3>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{def.resumo}</p>
      </div>

      {/* Valor grande */}
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            'text-4xl font-bold leading-none tabular-nums',
            semDados ? 'text-text-muted' : 'text-text-primary',
          )}
        >
          {valor}
        </span>
        {!semDados && def.unidade === 'percentual' && (
          <span className="text-lg font-semibold text-text-secondary">%</span>
        )}
        {!semDados && def.unidade === 'numero' && (
          <span className="text-xs text-text-muted">vezes em média</span>
        )}
      </div>

      {/* Meta + amostras */}
      <footer className="flex flex-col gap-1 border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cores.pontoBg)} aria-hidden />
          <span className={cn('text-[11px] font-medium', cores.texto)}>{def.rotuloMeta}</span>
        </div>
        <p className="text-[10px] text-text-muted">
          {semDados ? (
            <span className="italic">Sem dados ainda — continue usando o app</span>
          ) : (
            def.rotuloAmostras(kpi.amostras)
          )}
        </p>
      </footer>
    </article>
  );
}

function IndicadorSeveridade({ severidade }: { severidade: Severidade }) {
  if (severidade === 'neutro') {
    return (
      <span className="text-[10px] uppercase tracking-wider text-text-muted" aria-hidden>
        —
      </span>
    );
  }
  if (severidade === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-jade-accent">
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        no alvo
      </span>
    );
  }
  if (severidade === 'warn') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warning">
        <Timer className="h-3 w-3" aria-hidden />
        atenção
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-danger">
      <TrendingUp className="h-3 w-3" aria-hidden />
      fora
    </span>
  );
}

function descreverSituacao(sev: Severidade): string {
  switch (sev) {
    case 'ok':
      return 'dentro da meta';
    case 'warn':
      return 'atenção, pouco fora da meta';
    case 'danger':
      return 'fora da meta';
    default:
      return 'sem dados';
  }
}

// ---------------------------------------------------------------------------
// Resumo geral
// ---------------------------------------------------------------------------

function construirResumo(kpis: KpisAdiamento): {
  mensagem: string;
  dentroMeta: number;
  total: number;
} {
  const lista = [kpis.tra, kpis.tca, kpis.tex, kpis.mac, kpis.sae];
  const ativos = lista.filter((k) => k.amostras > 0);
  const total = lista.length;

  if (ativos.length === 0) {
    return {
      mensagem:
        'Ainda não temos adiamentos suficientes pra calcular. Use o app por alguns dias e volte aqui.',
      dentroMeta: 0,
      total,
    };
  }

  const dentroMeta = lista.filter((k) => k.amostras === 0 || k.dentroDaMeta).length;
  const foraMeta = total - dentroMeta;

  if (foraMeta === 0) {
    return { mensagem: 'Tudo dentro do alvo. Seu adiamento está saudável.', dentroMeta, total };
  }
  if (foraMeta === 1) {
    return { mensagem: '1 sinal fora do alvo. Vale dar uma olhada.', dentroMeta, total };
  }
  return {
    mensagem: `${foraMeta} sinais fora do alvo. Hora de revisar sua fila.`,
    dentroMeta,
    total,
  };
}

// ---------------------------------------------------------------------------
// Seletor de janela
// ---------------------------------------------------------------------------

function SeletorJanela({
  janela,
  onChange,
}: {
  janela: Janela;
  onChange: (j: Janela) => void;
}) {
  const opcoes: { valor: Janela; rotulo: string }[] = [
    { valor: 7, rotulo: '7d' },
    { valor: 30, rotulo: '30d' },
    { valor: 90, rotulo: '90d' },
  ];

  return (
    <div
      aria-label="Janela de análise"
      className="inline-flex shrink-0 rounded-full border border-border-strong bg-bg-surface p-0.5"
    >
      {opcoes.map((op) => {
        const ativo = janela === op.valor;
        return (
          <button
            key={op.valor}
            type="button"
            aria-pressed={ativo}
            aria-label={`Últimos ${op.valor} dias`}
            onClick={() => onChange(op.valor)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent/40',
              ativo
                ? 'bg-jade-accent/20 text-jade-accent shadow-sm'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            )}
          >
            {op.rotulo}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estados: loading (skeletons com shimmer) / erro
// ---------------------------------------------------------------------------

function GridSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton estático
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-border-strong bg-bg-elevated p-5"
          aria-hidden
        >
          <div className="flex items-center gap-2">
            <Shimmer className="h-4 w-10" />
            <Shimmer className="h-3 w-16" />
          </div>
          <Shimmer className="h-4 w-3/4" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="mt-2 h-10 w-1/3" />
          <div className="mt-2 space-y-1.5 border-t border-border pt-3">
            <Shimmer className="h-3 w-1/2" />
            <Shimmer className="h-2 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-bg-surface',
        'before:absolute before:inset-0 before:animate-shimmer',
        'before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent',
        className,
      )}
    />
  );
}

function EstadoErro({ mensagem }: { mensagem: string }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center">
      <RefreshCw className="mx-auto h-5 w-5 text-danger" aria-hidden />
      <p className="mt-2 text-sm font-medium text-text-primary">Não deu pra carregar</p>
      <p className="mt-1 text-xs text-text-secondary">{mensagem}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 rounded-full border border-border-strong bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      >
        Tentar de novo
      </button>
    </div>
  );
}
