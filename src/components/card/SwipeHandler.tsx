'use client';

import { type PanInfo, motion, useMotionValue, useTransform } from 'framer-motion';
import { type ReactNode, useEffect } from 'react';

export type SwipeDir = 'left' | 'right' | 'up' | 'down';

interface SwipeHandlerProps {
  children: ReactNode;
  onSwipe: (dir: SwipeDir) => void;
  disabled?: boolean;
}

const LIMIAR_DISTANCIA = 120;
const LIMIAR_VELOCIDADE = 500;

export function SwipeHandler({ children, onSwipe, disabled }: SwipeHandlerProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotate = useTransform(x, [-240, 0, 240], [-10, 0, 10]);
  const borderColor = useTransform([x, y] as const, (latest: unknown) => {
    const [lx, ly] = latest as [number, number];
    const max = Math.max(Math.abs(lx), Math.abs(ly));
    if (max < 40) return 'rgba(232,237,242,0.15)';
    if (Math.abs(lx) > Math.abs(ly)) {
      return lx > 0 ? 'rgba(44,175,147,0.9)' : 'rgba(122,135,150,0.9)';
    }
    return ly < 0 ? 'rgba(106,169,230,0.9)' : 'rgba(242,185,75,0.9)';
  });

  useEffect(() => {
    if (disabled) {
      x.set(0);
      y.set(0);
    }
  }, [disabled, x, y]);

  const handleEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void => {
    if (disabled) return;
    const { offset, velocity } = info;
    const horizontal = Math.abs(offset.x) > Math.abs(offset.y);
    if (horizontal) {
      if (offset.x > LIMIAR_DISTANCIA || velocity.x > LIMIAR_VELOCIDADE) {
        onSwipe('right');
        return;
      }
      if (offset.x < -LIMIAR_DISTANCIA || velocity.x < -LIMIAR_VELOCIDADE) {
        onSwipe('left');
        return;
      }
    } else {
      if (offset.y < -LIMIAR_DISTANCIA || velocity.y < -LIMIAR_VELOCIDADE) {
        onSwipe('up');
        return;
      }
      if (offset.y > LIMIAR_DISTANCIA || velocity.y > LIMIAR_VELOCIDADE) {
        onSwipe('down');
        return;
      }
    }
  };

  return (
    <motion.div
      drag={disabled ? false : true}
      dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
      dragElastic={0.5}
      onDragEnd={handleEnd}
      style={{ x, y, rotate, borderColor, borderWidth: 2, borderStyle: 'solid', borderRadius: 24 }}
      animate={{ x: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      whileTap={{ scale: 0.98 }}
      className="relative h-full w-full"
    >
      {children}
      {/* Overlays direcionais (convenção: esquerda=pular, direita=voltar) */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-start px-6 text-xl font-bold text-jade-accent"
        style={{ opacity: useTransform(x, [-240, -60, 0], [1, 0.4, 0]) }}
      >
        ← Pular
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-end px-6 text-xl font-bold text-text-secondary"
        style={{ opacity: useTransform(x, [0, 60, 240], [0, 0.4, 1]) }}
      >
        Voltar →
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-start justify-center pt-6 text-xl font-bold text-info"
        style={{ opacity: useTransform(y, [-240, -60, 0], [1, 0.4, 0]) }}
      >
        ↑ Adiar manual
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-end justify-center pb-6 text-xl font-bold text-warning"
        style={{ opacity: useTransform(y, [0, 60, 240], [0, 0.4, 1]) }}
      >
        ↓ Adiar auto
      </motion.div>
    </motion.div>
  );
}
