'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TaskCard } from '@/components/card/TaskCard';
import { SwipeHandler, type SwipeDir } from '@/components/card/SwipeHandler';
import { AdiamentoNivel2 } from '@/components/card/AdiamentoNivel2';
import { CompletionCelebration } from '@/components/celebration/CompletionCelebration';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { useCardStackStore } from '@/stores/cardStack';
import { useGamificacaoStore } from '@/stores/gamificacao';
import { mockTarefas } from '@/lib/mock/tarefas';
import { playCompletion, playLevelUp, playSwipe } from '@/lib/audio/tones';
import type { Tarefa } from '@/types/domain';

export default function CardsPage() {
  const router = useRouter();
  const {
    fila,
    setFila,
    atual,
    proxima,
    anterior,
    concluir,
    abrirNivel2Adiar,
    fecharNivel2Adiar,
    adiarAte,
    nivel2Adiar,
    removerAtual,
  } = useCardStackStore();
  const {
    streakAtual,
    nivel,
    progressoPercentual,
    hidratar: hidratarGami,
    registrarConclusao,
  } = useGamificacaoStore();
  const [celebrando, setCelebrando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [ultimoXp, setUltimoXp] = useState(10);
  const tarefaAtual = atual();

  useEffect(() => {
    void hidratarGami();
  }, [hidratarGami]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch('/api/fila', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { fila: filaReal } = (await res.json()) as { fila: Tarefa[] };
        if (cancelado) return;
        if (filaReal.length === 0) {
          setFila([...mockTarefas].sort((a, b) => b.nota - a.nota));
          setErroCarga('Sem tarefas reais — usando mock.');
        } else {
          setFila(filaReal);
        }
      } catch (e) {
        if (cancelado) return;
        console.error(e);
        setFila([...mockTarefas].sort((a, b) => b.nota - a.nota));
        setErroCarga(e instanceof Error ? e.message : 'Erro ao carregar');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sincronizarAcao(
    tarefaId: string,
    payload: { tipo: 'concluir' } | { tipo: 'adiar'; ate: string; motivoAuto?: string } | { tipo: 'excluir' },
  ): Promise<void> {
    try {
      await fetch(`/api/tarefas/${tarefaId}/acao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('sincronizarAcao falhou (UI segue otimista):', e);
    }
  }

  const handleSwipe = (dir: SwipeDir): void => {
    void playSwipe(dir);
    // Convenção: esquerda = próxima, direita = anterior.
    if (dir === 'left') proxima();
    else if (dir === 'right') anterior();
    else if (dir === 'up') abrirNivel2Adiar();
    else if (dir === 'down') {
      const adiarAutoAte = new Date();
      adiarAutoAte.setHours(adiarAutoAte.getHours() + 3);
      const atualTarefa = tarefaAtual;
      adiarAte(adiarAutoAte);
      if (atualTarefa) {
        void sincronizarAcao(atualTarefa.id, {
          tipo: 'adiar',
          ate: adiarAutoAte.toISOString(),
          motivoAuto: '+3h',
        });
      }
    }
  };

  const handleConcluir = (): void => {
    if (!tarefaAtual) return;
    const { id, nota, tipo } = tarefaAtual;
    const xpEstimado = tipo === 'lembrete' ? 5 : 10 + Math.round(nota / 10);
    setUltimoXp(xpEstimado);
    setCelebrando(true);
    void playCompletion(streakAtual > 0);
    window.setTimeout(() => {
      concluir();
      void sincronizarAcao(id, { tipo: 'concluir' });
      void (async () => {
        const r = await registrarConclusao(id, tipo, nota);
        if (r?.subiuNivel) void playLevelUp();
      })();
    }, 600);
  };

  const handleAdiarManual = (ate: Date): void => {
    const atualTarefa = tarefaAtual;
    adiarAte(ate);
    if (atualTarefa) {
      void sincronizarAcao(atualTarefa.id, { tipo: 'adiar', ate: ate.toISOString() });
    }
  };

  const handleExcluir = (): void => {
    if (!tarefaAtual) return;
    const id = tarefaAtual.id;
    removerAtual();
    void sincronizarAcao(id, { tipo: 'excluir' });
  };

  useKeyboardNav({
    onLeft: () => !nivel2Adiar && handleSwipe('left'),
    onRight: () => !nivel2Adiar && handleSwipe('right'),
    onUp: () => !nivel2Adiar && handleSwipe('up'),
    onDown: () => !nivel2Adiar && handleSwipe('down'),
    onSpace: () => !nivel2Adiar && handleConcluir(),
    onEnter: () => !nivel2Adiar && handleConcluir(),
    onEscape: () => nivel2Adiar && fecharNivel2Adiar(),
    onDelete: () => !nivel2Adiar && handleExcluir(),
  });

  const pendentes = fila.filter((t: Tarefa) => t.status === 'pendente');
  const lembretesPendentes = pendentes.filter((t) => t.tipo === 'lembrete').length;

  return (
    <main className="relative flex min-h-dvh flex-col safe-top safe-bottom">
      <header className="flex items-center justify-between px-6 py-4 text-xs text-text-muted">
        <span>
          {pendentes.length} pendentes · {lembretesPendentes} lembretes
          {erroCarga && <span className="ml-2 text-warning">· {erroCarga}</span>}
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full border border-jade-accent/40 bg-jade-dim/30 px-2.5 py-1 font-medium text-jade-accent"
            title={`Nível ${nivel} · ${progressoPercentual}% do próximo`}
          >
            ⚡ N{nivel}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-bg-elevated px-3 py-1 font-medium text-jade-accent"
            title="Streak (dias consecutivos com ao menos 1 conclusão)"
          >
            🔥 {streakAtual}
          </span>
        </span>
      </header>

      <section className="relative flex flex-1 items-center justify-center px-4 pb-6">
        <div className="relative h-[640px] w-full max-w-md md:h-[680px]">
          <AnimatePresence mode="wait">
            {carregando ? (
              <motion.div
                key="loading"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="h-12 w-12 animate-pulse-jade rounded-full bg-jade" />
              </motion.div>
            ) : nivel2Adiar ? (
              <AdiamentoNivel2
                key="nivel2"
                onEscolher={handleAdiarManual}
                onCancelar={() => fecharNivel2Adiar()}
              />
            ) : tarefaAtual ? (
              <motion.div
                key={tarefaAtual.id}
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -120, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                className="absolute inset-0"
              >
                <SwipeHandler onSwipe={handleSwipe}>
                  <TaskCard
                    tarefa={tarefaAtual}
                    onConcluir={handleConcluir}
                    onExcluir={handleExcluir}
                    onEditar={() => {}}
                    onDependencia={() => {}}
                    onAdicionar={() => {}}
                    onListar={() => router.push('/tarefas')}
                  />
                </SwipeHandler>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-border-strong bg-bg-elevated p-8 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full grad-jade">
                  🌿
                </div>
                <h2 className="text-xl font-semibold">Tudo feito por agora</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Sincronize com Todoist ou adicione uma tarefa nova.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <CompletionCelebration
            visivel={celebrando}
            xpGanho={ultimoXp}
            onFim={() => setCelebrando(false)}
          />
        </div>
      </section>
    </main>
  );
}
