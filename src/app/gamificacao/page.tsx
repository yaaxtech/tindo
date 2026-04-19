'use client';

import { cn } from '@/lib/utils';
import { useGamificacaoStore } from '@/stores/gamificacao';
import { ArrowLeft, Flame, Trophy, Zap } from 'lucide-react';
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
    hidratar,
  } = useGamificacaoStore();

  const [historico, setHistorico] = useState<HistoricoDia[]>([]);

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
  }, [hidratar]);

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
