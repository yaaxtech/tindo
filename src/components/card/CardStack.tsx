'use client';

/**
 * CardStack — visual Tinder-style card stack com physics framer-motion.
 *
 * Layout:
 *   topo   (fila[indice])   → z=30, scale=1,    y=0px,  opacity=1
 *   atras1 (fila[indice+1]) → z=20, scale=0.95, y=14px, opacity=0.85
 *   atras2 (fila[indice+2]) → z=10, scale=0.90, y=28px, opacity=0.65
 *
 * Animações (prefers-reduced-motion: troca instantânea, stack desabilitado).
 */

import { type SwipeDir, SwipeHandler } from '@/components/card/SwipeHandler';
import type { Tarefa } from '@/types/domain';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type React from 'react';
import { useCallback, useState } from 'react';

// ─── tipos ─────────────────────────────────────────────────────────────────

export type PosicaoCard = 'topo' | 'atras1' | 'atras2';

export interface CardStackProps {
  fila: Tarefa[];
  indice: number;
  /** Animação de saída disparada externamente (teclado). */
  animacaoEmCurso?: SwipeDir | null;
  onSwipe: (dir: SwipeDir) => void;
  /** Renderiza o conteúdo de cada card; permite injetar TaskCard + overlays. */
  renderCard: (tarefa: Tarefa, posicao: PosicaoCard) => React.ReactNode;
}

// ─── constantes de spring ──────────────────────────────────────────────────

const SPRING_EXIT = { type: 'spring', stiffness: 280, damping: 24 } as const;
const SPRING_PROMO = { type: 'spring', stiffness: 240, damping: 28 } as const;
const TWEEN_ENTRADA = { type: 'tween', duration: 0.24, ease: 'easeOut' } as const;

// Posições base de cada camada (aplicadas via motion.div animate)
const CAMADAS: Record<PosicaoCard, { scale: number; y: number; opacity: number; zIndex: number }> =
  {
    topo: { scale: 1, y: 0, opacity: 1, zIndex: 30 },
    atras1: { scale: 0.95, y: 14, opacity: 0.85, zIndex: 20 },
    atras2: { scale: 0.9, y: 28, opacity: 0.65, zIndex: 10 },
  };

// Sombras crescentes conforme a camada recua
const SOMBRAS: Record<PosicaoCard, string> = {
  topo: '0 16px 48px rgba(0,0,0,0.55)',
  atras1: '0 8px 24px rgba(0,0,0,0.40)',
  atras2: '0 4px 12px rgba(0,0,0,0.28)',
};

// Calcula target de exit baseado na direção
function calcularExitTarget(dir: SwipeDir): {
  x?: number;
  y?: number;
  rotate?: number;
  opacity: number;
} {
  if (dir === 'left') return { x: -520, rotate: -12, opacity: 0 };
  if (dir === 'right') return { x: 520, rotate: 12, opacity: 0 };
  if (dir === 'up') return { y: -420, opacity: 0 };
  return { y: 320, opacity: 0 }; // down
}

// ─── componente ────────────────────────────────────────────────────────────

export function CardStack({ fila, indice, animacaoEmCurso, onSwipe, renderCard }: CardStackProps) {
  const reduzido = useReducedMotion();

  // Rastreia direção do exit para animar corretamente
  const [exitDir, setExitDir] = useState<SwipeDir>('right');
  // Estado de will-change (só durante animação)
  const [animando, setAnimando] = useState(false);

  // Captura a direção antes de cada swipe para usar no exit
  const handleSwipeInterno = useCallback(
    (dir: SwipeDir) => {
      setExitDir(dir);
      onSwipe(dir);
    },
    [onSwipe],
  );

  const tarefaTopo = fila[indice] ?? null;
  const tarefaAtras1 = fila[indice + 1] ?? null;
  const tarefaAtras2 = fila[indice + 2] ?? null;

  // ── reduced-motion: stack simples sem camadas de fundo ──────────────────
  if (reduzido) {
    return (
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          {tarefaTopo ? (
            <motion.div
              key={tarefaTopo.id}
              className="absolute inset-0"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <SwipeHandler onSwipe={handleSwipeInterno} animacaoEmCurso={animacaoEmCurso}>
                {renderCard(tarefaTopo, 'topo')}
              </SwipeHandler>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  // ── stack completo ───────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0">
      {/* Camada 2 — mais atrás (renderizada primeiro = visualmente embaixo) */}
      <AnimatePresence initial={false}>
        {tarefaAtras2 && (
          <motion.div
            key={`atras2-${tarefaAtras2.id}`}
            className="absolute inset-0 pointer-events-none"
            initial={CAMADAS.atras2}
            animate={CAMADAS.atras2}
            exit={{ opacity: 0, scale: 0.85, transition: TWEEN_ENTRADA }}
            transition={SPRING_PROMO}
            style={{
              zIndex: CAMADAS.atras2.zIndex,
              boxShadow: SOMBRAS.atras2,
              borderRadius: 16,
              overflow: 'hidden',
              willChange: animando ? 'transform' : 'auto',
            }}
          >
            {renderCard(tarefaAtras2, 'atras2')}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camada 1 — atrás imediato */}
      <AnimatePresence initial={false}>
        {tarefaAtras1 && (
          <motion.div
            key={`atras1-${tarefaAtras1.id}`}
            className="absolute inset-0 pointer-events-none"
            initial={CAMADAS.atras2}
            animate={CAMADAS.atras1}
            exit={{ opacity: 0, scale: 0.88, transition: TWEEN_ENTRADA }}
            transition={SPRING_PROMO}
            style={{
              zIndex: CAMADAS.atras1.zIndex,
              boxShadow: SOMBRAS.atras1,
              borderRadius: 16,
              overflow: 'hidden',
              willChange: animando ? 'transform' : 'auto',
            }}
          >
            {renderCard(tarefaAtras1, 'atras1')}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camada 0 — topo (recebe gestos) */}
      <AnimatePresence mode="wait" onExitComplete={() => setAnimando(false)}>
        {tarefaTopo ? (
          <motion.div
            key={tarefaTopo.id}
            className="absolute inset-0"
            initial={{ scale: 0.95, y: 14, opacity: 0.8 }}
            animate={CAMADAS.topo}
            exit={calcularExitTarget(exitDir)}
            transition={SPRING_EXIT}
            onAnimationStart={() => setAnimando(true)}
            onAnimationComplete={() => setAnimando(false)}
            style={{
              zIndex: CAMADAS.topo.zIndex,
              boxShadow: SOMBRAS.topo,
              borderRadius: 16,
              willChange: animando ? 'transform, opacity' : 'auto',
            }}
          >
            <SwipeHandler onSwipe={handleSwipeInterno} animacaoEmCurso={animacaoEmCurso}>
              {renderCard(tarefaTopo, 'topo')}
            </SwipeHandler>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
