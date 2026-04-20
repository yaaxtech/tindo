'use client';

import { type PanInfo, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { type ReactNode, useEffect, useRef, useState } from 'react';

export type SwipeDir = 'left' | 'right' | 'up' | 'down';

interface SwipeHandlerProps {
  children: ReactNode;
  onSwipe: (dir: SwipeDir) => void;
  disabled?: boolean;
  /** Quando setado, dispara animação de saída na direção indicada e chama onSwipe no final. */
  animacaoEmCurso?: SwipeDir | null;
}

const LIMIAR_DISTANCIA = 120;
const LIMIAR_VELOCIDADE = 500;
const DURACAO_ANIMACAO = 180; // ms

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function SwipeHandler({ children, onSwipe, disabled, animacaoEmCurso }: SwipeHandlerProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // Rastreia se animação já foi disparada pra evitar dupla chamada
  const animandoRef = useRef<SwipeDir | null>(null);
  // Quando true, desativa o "snap back" automático pra deixar o exit do pai fluir
  const [saindo, setSaindo] = useState(false);

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

  // Animação imperativa disparada pelo teclado
  useEffect(() => {
    if (!animacaoEmCurso || animandoRef.current === animacaoEmCurso) return;
    animandoRef.current = animacaoEmCurso;

    if (prefersReducedMotion()) {
      // Sem animação — troca instantânea
      onSwipe(animacaoEmCurso);
      animandoRef.current = null;
      return;
    }

    const dir = animacaoEmCurso;
    const duration = DURACAO_ANIMACAO / 1000; // framer-motion usa segundos

    const targets: { x?: number; y?: number } =
      dir === 'left'
        ? { x: -420 }
        : dir === 'right'
          ? { x: 420 }
          : dir === 'up'
            ? { y: -300 }
            : { y: 200 };

    const controls: Array<ReturnType<typeof animate>> = [];

    if (targets.x !== undefined) {
      controls.push(animate(x, targets.x, { duration, ease: [0.4, 0, 1, 1] }));
      // Rotate durante saída horizontal
      controls.push(animate(rotate, dir === 'left' ? -8 : 8, { duration, ease: [0.4, 0, 1, 1] }));
    } else if (targets.y !== undefined) {
      controls.push(animate(y, targets.y, { duration, ease: [0.4, 0, 1, 1] }));
    }

    const timeout = window.setTimeout(() => {
      onSwipe(dir);
      // Reset posição (o card vai ser removido/substituído, mas por segurança)
      x.set(0);
      y.set(0);
      animandoRef.current = null;
    }, DURACAO_ANIMACAO);

    return () => {
      window.clearTimeout(timeout);
      controls.forEach((c) => c.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animacaoEmCurso]);

  const confirmarSwipe = (dir: SwipeDir): void => {
    setSaindo(true);
    // Continua o movimento na direção do gesto para suavizar junto com o exit do CardStack
    if (dir === 'right') {
      animate(x, 600, { duration: 0.22, ease: [0.4, 0, 1, 1] });
      animate(rotate, 14, { duration: 0.22 });
    } else if (dir === 'left') {
      animate(x, -600, { duration: 0.22, ease: [0.4, 0, 1, 1] });
      animate(rotate, -14, { duration: 0.22 });
    } else if (dir === 'up') {
      animate(y, -500, { duration: 0.22, ease: [0.4, 0, 1, 1] });
    } else {
      animate(y, 500, { duration: 0.22, ease: [0.4, 0, 1, 1] });
    }
    onSwipe(dir);
  };

  const handleEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void => {
    if (disabled) return;
    const { offset, velocity } = info;
    const horizontal = Math.abs(offset.x) > Math.abs(offset.y);
    if (horizontal) {
      if (offset.x > LIMIAR_DISTANCIA || velocity.x > LIMIAR_VELOCIDADE) {
        confirmarSwipe('right');
        return;
      }
      if (offset.x < -LIMIAR_DISTANCIA || velocity.x < -LIMIAR_VELOCIDADE) {
        confirmarSwipe('left');
        return;
      }
    } else {
      if (offset.y < -LIMIAR_DISTANCIA || velocity.y < -LIMIAR_VELOCIDADE) {
        confirmarSwipe('up');
        return;
      }
      if (offset.y > LIMIAR_DISTANCIA || velocity.y > LIMIAR_VELOCIDADE) {
        confirmarSwipe('down');
        return;
      }
    }
    // Gesto não cruzou limiar — snap back ao centro via spring
    animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
    animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
  };

  return (
    <motion.div
      drag={!disabled && !saindo}
      dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
      dragElastic={0.5}
      onDragEnd={handleEnd}
      style={{ x, y, rotate, borderColor, borderWidth: 2, borderStyle: 'solid', borderRadius: 24 }}
      whileTap={saindo ? undefined : { scale: 0.98 }}
      className="relative h-full w-full"
    >
      {children}
      {/* Overlays direcionais (convenção: esquerda=voltar, direita=avançar) */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-start px-6 text-xl font-bold text-text-secondary"
        style={{ opacity: useTransform(x, [-240, -60, 0], [1, 0.4, 0]) }}
      >
        ← Voltar
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-end px-6 text-xl font-bold text-jade-accent"
        style={{ opacity: useTransform(x, [0, 60, 240], [0, 0.4, 1]) }}
      >
        Avançar →
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
