'use client';

import { cn } from '@/lib/utils';
import type { Aneis } from '@/lib/gamificacao/aneis';
import { useGamificacaoStore } from '@/stores/gamificacao';
import { useToasts } from '@/stores/toasts';
import { ArrowLeft, Flame, Snowflake, Trophy, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface HistoricoDia {
  dia: string;
  concluidas: number;
  adiadas: number;
  total: number;
}

export default function GamificacaoPage() {
  const {
    xpTotal,
    nivel,
    streakAtual,
    streakRecorde,
    tarefasConcluidasTotal,
    lembretesConcluidosTotal,
    xpNoNivelAtual,
    xpParaProximoNivel,
    progressoPercentual,
    freezersDisponiveis,
    hidratar,
    comprarFreezer,
  } = useGamificacaoStore();
  const { push: pushToast } = useToasts();

  const [historico, setHistorico] = useState<HistoricoDia[]>([]);
  const [aneis, setAneis] = useState<Aneis | null>(null);
  const [comprando, setComprando] = useState(false);

  useEffect(() => {
    void hidratar();
    void (async () => {
      try {
        const res = await fetch('/api/gamificacao/historico');
        const body = (await res.json()) as { serie: HistoricoDia[] };
        setHistorico(body.serie);
      } catch {
        /* ignore */
      }
    })();
    void (async () => {
      try {
        const res = await fetch('/api/gamificacao/aneis');
        if (res.ok) {
          const body = (await res.json()) as { aneis: Aneis };
          setAneis(body.aneis);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [hidratar]);

  async function handleComprarFreezer() {
    if (comprando) return;
    setComprando(true);
    try {
      const resultado = await comprarFreezer();
      if (!resultado) {
        pushToast({ titulo: 'Erro ao comprar freezer.', icone: 'alerta' });
        return;
      }
      if (!resultado.ok) {
        pushToast({ titulo: resultado.erro ?? 'Erro ao comprar freezer.', icone: 'alerta' });
        return;
      }
      pushToast({ titulo: 'Freezer comprado! Seu streak está protegido.', icone: 'ok' });
      void hidratar();
    } finally {
      setComprando(false);
    }
  }

  const mapaHistorico = new Map(historico.map((h) => [h.dia, h]));
  const dias = construirUltimos(90);

  return (
    <main className="min-h-dvh pb-16 safe-top safe-bottom">
      <header className="sticky top-0 z-10 border-b border-border bg-bg-deep/80 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4">
          <Link
            href="/cards"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Sua evolução</h1>
            <p className="text-xs text-text-muted">Juízo humano + prazer = caminho sustentável.</p>
          </div>
        </div>
      </header>

      <section className="mx-auto mt-6 w-full max-w-3xl px-6">
        {/* Big cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BigCard
            icone={<Zap className="h-6 w-6" />}
            label="Nível"
            valor={String(nivel)}
            sub={`${xpTotal} XP total`}
            glow
          />
          <BigCard
            icone={<Flame className="h-6 w-6" />}
            label="Streak"
            valor={`${streakAtual} ${streakAtual === 1 ? 'dia' : 'dias'}`}
            sub={`Recorde ${streakRecorde}`}
          />
          <BigCard
            icone={<Trophy className="h-6 w-6" />}
            label="Concluídas"
            valor={String(tarefasConcluidasTotal + lembretesConcluidosTotal)}
            sub={`${tarefasConcluidasTotal} tarefas · ${lembretesConcluidosTotal} lembretes`}
          />
        </div>

        {/* XP Bar */}
        <section className="mt-8 rounded-xl border border-border-strong bg-bg-elevated p-5">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Progresso pro nível {nivel + 1}</h2>
            <p className="font-mono text-xs text-text-muted">
              {xpNoNivelAtual} / {xpParaProximoNivel} XP
            </p>
          </header>
          <div className="h-3 overflow-hidden rounded-full bg-bg-surface">
            <div
              className="h-full grad-jade transition-all duration-500"
              style={{ width: `${Math.min(100, progressoPercentual)}%` }}
            />
          </div>
        </section>

        {/* Anéis semanais */}
        <section className="mt-8 rounded-xl border border-border-strong bg-bg-elevated p-5">
          <header className="mb-4">
            <h2 className="text-sm font-semibold">Semana atual</h2>
            <p className="text-xs text-text-muted">3 metas semanais em forma de anéis.</p>
          </header>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
            <AnelCircular
              percentual={aneis?.concluir.percentual ?? 0}
              cor="#198B74"
              label="Concluir"
              valor={aneis?.concluir.valor ?? 0}
              meta={aneis?.concluir.meta ?? 7}
              unidade="dias"
            />
            <AnelCircular
              percentual={aneis?.foco.percentual ?? 0}
              cor="#2CAF93"
              label="Foco"
              valor={aneis?.foco.valor ?? 0}
              meta={aneis?.foco.meta ?? 35}
              unidade="conclusões"
            />
            <AnelCircular
              percentual={aneis?.consistencia.percentual ?? 0}
              cor="#F2B94B"
              label="Consistência"
              valor={aneis?.consistencia.valor ?? 0}
              meta={aneis?.consistencia.meta ?? 7}
              unidade="dias no horário"
            />
          </div>
        </section>

        {/* Freezers de streak */}
        <section className="mt-4 rounded-xl border border-border-strong bg-bg-elevated p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-surface text-blue-400">
                <Snowflake className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  Freezers disponíveis:{' '}
                  <span className="text-blue-400">{freezersDisponiveis}</span>
                  <span className="ml-1 text-xs text-text-muted">/ 3</span>
                </p>
                <p className="text-xs text-text-muted">
                  Protege seu streak quando você pula 1 dia. Ganhe 1 a cada 7 dias de streak.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={xpTotal < 200 || freezersDisponiveis >= 3 || comprando}
              onClick={() => void handleComprarFreezer()}
              className={cn(
                'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                xpTotal >= 200 && freezersDisponiveis < 3
                  ? 'border-jade-accent/40 bg-jade/20 text-jade-accent hover:bg-jade/40'
                  : 'cursor-not-allowed border-border bg-bg-surface text-text-muted opacity-50',
              )}
            >
              {comprando ? 'Comprando…' : 'Comprar freezer (200 XP)'}
            </button>
          </div>
        </section>

        {/* Heatmap 90 dias */}
        <section className="mt-8 rounded-xl border border-border-strong bg-bg-elevated p-5">
          <header className="mb-4">
            <h2 className="text-sm font-semibold">Últimos 90 dias</h2>
            <p className="text-xs text-text-muted">Intensidade = tarefas concluídas no dia.</p>
          </header>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(10px,1fr))] gap-[3px]">
            {dias.map((d) => {
              const h = mapaHistorico.get(d);
              const concluidas = h?.concluidas ?? 0;
              return (
                <div
                  key={d}
                  title={`${d}: ${concluidas} concluídas, ${h?.adiadas ?? 0} adiadas`}
                  className={cn(
                    'aspect-square rounded-sm',
                    concluidas === 0 && 'bg-bg-surface',
                    concluidas > 0 && concluidas < 3 && 'bg-jade-dim',
                    concluidas >= 3 && concluidas < 6 && 'bg-jade',
                    concluidas >= 6 && concluidas < 10 && 'bg-jade-accent',
                    concluidas >= 10 && 'bg-jade-accent ring-2 ring-jade-accent/40',
                  )}
                />
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3 text-[10px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-bg-surface" /> 0
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-jade-dim" /> 1-2
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-jade" /> 3-5
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-jade-accent" /> 6+
            </span>
          </div>
        </section>

        {/* Navegação */}
        <nav className="mt-6 flex flex-wrap items-center gap-2 text-xs">
          <Link
            href="/tarefas"
            className="rounded-full border border-border-strong bg-bg-elevated px-3 py-1.5 font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            Ver lista
          </Link>
          <Link
            href="/projetos"
            className="rounded-full border border-border-strong bg-bg-elevated px-3 py-1.5 font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            Projetos
          </Link>
          <Link
            href="/configuracoes"
            className="rounded-full border border-border-strong bg-bg-elevated px-3 py-1.5 font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            Configurações
          </Link>
        </nav>
      </section>
    </main>
  );
}

function construirUltimos(n: number): string[] {
  const arr: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push(d.toISOString().slice(0, 10));
  }
  return arr;
}

const ANEL_R = 36;
const ANEL_CIRCUNFERENCIA = 2 * Math.PI * ANEL_R;

function AnelCircular({
  percentual,
  cor,
  label,
  valor,
  meta,
  unidade,
}: {
  percentual: number;
  cor: string;
  label: string;
  valor: number;
  meta: number;
  unidade: string;
}) {
  const offset = ANEL_CIRCUNFERENCIA * (1 - Math.min(100, percentual) / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        {/* Track */}
        <circle
          cx="48"
          cy="48"
          r={ANEL_R}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
        />
        {/* Progresso */}
        <circle
          cx="48"
          cy="48"
          r={ANEL_R}
          fill="none"
          stroke={cor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={ANEL_CIRCUNFERENCIA}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="text-center text-sm font-bold" style={{ color: cor }}>
        {valor}
        <span className="text-xs font-normal text-text-muted">/{meta}</span>
      </p>
      <p className="text-center text-[10px] text-text-muted">{unidade}</p>
    </div>
  );
}

function BigCard({
  icone,
  label,
  valor,
  sub,
  glow,
}: {
  icone: React.ReactNode;
  label: string;
  valor: string;
  sub: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border-strong bg-bg-elevated p-5',
        glow && 'shadow-glow border-jade-accent/40',
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-jade-accent">
        {icone}
        <span className="text-[11px] uppercase tracking-wider text-text-muted">{label}</span>
      </div>
      <p className="text-3xl font-bold">{valor}</p>
      <p className="mt-1 text-xs text-text-secondary">{sub}</p>
    </div>
  );
}
