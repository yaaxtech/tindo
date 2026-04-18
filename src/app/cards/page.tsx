'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { TaskCard } from '@/components/card/TaskCard';
import { SwipeHandler, type SwipeDir } from '@/components/card/SwipeHandler';
import { AdiamentoNivel2 } from '@/components/card/AdiamentoNivel2';
import { CompletionCelebration } from '@/components/celebration/CompletionCelebration';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { useCardStackStore } from '@/stores/cardStack';
import { mockTarefas } from '@/lib/mock/tarefas';
import { playCompletion, playSwipe } from '@/lib/audio/tones';
import type { Tarefa } from '@/types/domain';

export default function CardsPage() {
  const { fila, setFila, atual, proxima, anterior, concluir, abrirNivel2Adiar, fecharNivel2Adiar, adiarAte, nivel2Adiar, removerAtual } =
    useCardStackStore();
  const [celebrando, setCelebrando] = useState(false);
  const tarefaAtual = atual();

  useEffect(() => {
    if (fila.length === 0) setFila([...mockTarefas].sort((a, b) => b.nota - a.nota));
  }, [fila.length, setFila]);

  const handleSwipe = (dir: SwipeDir): void => {
    void playSwipe(dir);
    if (dir === 'right') proxima();
    else if (dir === 'left') anterior();
    else if (dir === 'up') abrirNivel2Adiar();
    else if (dir === 'down') {
      const adiarAutoAte = new Date();
      adiarAutoAte.setHours(adiarAutoAte.getHours() + 3);
      adiarAte(adiarAutoAte);
    }
  };

  const handleConcluir = (): void => {
    if (!tarefaAtual) return;
    setCelebrando(true);
    void playCompletion();
    window.setTimeout(() => concluir(), 600);
  };

  useKeyboardNav({
    onLeft: () => !nivel2Adiar && handleSwipe('left'),
    onRight: () => !nivel2Adiar && handleSwipe('right'),
    onUp: () => !nivel2Adiar && handleSwipe('up'),
    onDown: () => !nivel2Adiar && handleSwipe('down'),
    onSpace: () => !nivel2Adiar && handleConcluir(),
    onEnter: () => !nivel2Adiar && handleConcluir(),
    onEscape: () => nivel2Adiar && fecharNivel2Adiar(),
    onDelete: () => !nivel2Adiar && removerAtual(),
  });

  const pendentes = fila.filter((t: Tarefa) => t.status === 'pendente');
  const lembretesPendentes = pendentes.filter((t) => t.tipo === 'lembrete').length;

  return (
    <main className="relative flex min-h-dvh flex-col safe-top safe-bottom">
      <header className="flex items-center justify-between px-6 py-4 text-xs text-text-muted">
        <span>
          {pendentes.length} pendentes · {lembretesPendentes} lembretes
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-bg-elevated px-3 py-1 font-medium text-jade-accent">
          🔥 0 dias
        </span>
      </header>

      <section className="relative flex flex-1 items-center justify-center px-4 pb-6">
        <div className="relative h-[640px] w-full max-w-md md:h-[680px]">
          <AnimatePresence mode="wait">
            {nivel2Adiar ? (
              <AdiamentoNivel2
                key="nivel2"
                onEscolher={(ate) => adiarAte(ate)}
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
                    onExcluir={() => removerAtual()}
                    onEditar={() => {}}
                    onDependencia={() => {}}
                    onAdicionar={() => {}}
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
                <button
                  type="button"
                  onClick={() => setFila([...mockTarefas].sort((a, b) => b.nota - a.nota))}
                  className="mt-6 h-10 rounded-md grad-jade px-6 text-sm font-medium text-text-inverse"
                >
                  Recarregar mock
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <CompletionCelebration
            visivel={celebrando}
            xpGanho={tarefaAtual ? Math.max(10, Math.round(tarefaAtual.nota / 5)) : 10}
            onFim={() => setCelebrando(false)}
          />
        </div>
      </section>
    </main>
  );
}
