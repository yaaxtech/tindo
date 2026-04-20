'use client';

import { type PanInfo, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { type ReactNode, useEffect, useRef } from 'react';

export type SwipeDir = 'left' | 'right' | 'up' | 'down';

interface SwipeHandlerProps {
  children: ReactNode;
  onSwipe: (dir: SwipeDir) => void;
  disabled?: boolean;
  /** Quando setado, dispara animação imperativa de saída + onSwipe ao final (usado pelo teclado). */
  animacaoEmCurso?: SwipeDir | null;
}

const LIMIAR_DISTANCIA = 120;
const LIMIAR_VELOCIDADE = 500;
const DURACAO_EXIT = 180; // ms

export function SwipeHandler({ children, onSwipe, disabled, animacaoEmCurso }: SwipeHandlerProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 0, 240], [-10, 0, 10]);
  const animouRef = useRef(false);

  // Animação disparada pelo teclado (imperativa). Exit pro lado + callback ao fim.
  useEffect(() => {
    if (!animacaoEmCurso || animouRef.current) return;
    animouRef.current = true;
    const dir = animacaoEmCurso;
    const dur = DURACAO_EXIT / 1000;
    const ease: [number, number, number, number] = [0.4, 0, 1, 1];

    if (dir === 'left') animate(x, -600, { duration: dur, ease });
    else if (dir === 'right') animate(x, 600, { duration: dur, ease });
    else if (dir === 'up') animate(y, -500, { duration: dur, ease });
    else animate(y, 500, { duration: dur, ease });

    const t = window.setTimeout(() => {
      onSwipe(dir);
      animouRef.current = false;
    }, DURACAO_EXIT);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animacaoEmCurso]);

  const handleEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void => {
    if (disabled) return;
    const { offset, velocity } = info;
    const horizontal = Math.abs(offset.x) > Math.abs(offset.y);
    if (horizontal) {
      if (offset.x > LIMIAR_DISTANCIA || velocity.x > LIMIAR_VELOCIDADE) {
        // Continua o movimento e dispara — AnimatePresence cuida do exit visual
        animate(x, 600, { duration: 0.22, ease: [0.4, 0, 1, 1] });
        onSwipe('right');
        return;
      }
      if (offset.x < -LIMIAR_DISTANCIA || velocity.x < -LIMIAR_VELOCIDADE) {
        animate(x, -600, { duration: 0.22, ease: [0.4, 0, 1, 1] });
        onSwipe('left');
        return;
      }
    } else {
      if (offset.y < -LIMIAR_DISTANCIA || velocity.y < -LIMIAR_VELOCIDADE) {
        animate(y, -500, { duration: 0.22, ease: [0.4, 0, 1, 1] });
        onSwipe('up');
        return;
      }
      if (offset.y > LIMIAR_DISTANCIA || velocity.y > LIMIAR_VELOCIDADE) {
        animate(y, 500, { duration: 0.22, ease: [0.4, 0, 1, 1] });
        onSwipe('down');
        return;
      }
    }
    // Gesto abaixo do limiar — volta ao centro
    animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
    animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
  };

  // Overlays direcionais (visibilidade proporcional ao drag)
  const opacityEsq = useTransform(x, [-240, -60, 0], [1, 0.4, 0]);
  const opacityDir = useTransform(x, [0, 60, 240], [0, 0.4, 1]);

  return (
    <motion.div
      drag={!disabled}
      dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={handleEnd}
      style={{ x, y, rotate }}
      whileTap={{ scale: 0.98 }}
      className="relative h-full w-full"
    >
      {children}
      {/* Overlays: ← voltar (esquerda) / avançar → (direita) */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-start px-8 text-2xl font-bold text-text-secondary"
        style={{ opacity: opacityEsq }}
      >
        ← voltar
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-end px-8 text-2xl font-bold text-jade-accent"
        style={{ opacity: opacityDir }}
      >
        avançar →
      </motion.div>
    </motion.div>
  );
}
