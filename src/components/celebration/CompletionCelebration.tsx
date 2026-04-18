'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

interface CompletionCelebrationProps {
  visivel: boolean;
  xpGanho: number;
  onFim: () => void;
}

export function CompletionCelebration({ visivel, xpGanho, onFim }: CompletionCelebrationProps) {
  const [showXp, setShowXp] = useState(false);

  useEffect(() => {
    if (!visivel) return;
    disparaConfetti();
    const t1 = window.setTimeout(() => setShowXp(true), 500);
    const t2 = window.setTimeout(() => {
      setShowXp(false);
      onFim();
    }, 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [visivel, onFim]);

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          key="celebration"
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="flex h-28 w-28 items-center justify-center rounded-full grad-jade glow-jade"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.25, 1] }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Check className="h-14 w-14 text-text-inverse" strokeWidth={3} />
          </motion.div>
          {showXp && (
            <motion.div
              className="absolute text-2xl font-bold text-jade-accent"
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: -60, opacity: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            >
              +{xpGanho} XP
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function disparaConfetti(): void {
  const colors = ['#198B74', '#2CAF93', '#6AA9E6', '#E8EDF2'];
  confetti({
    particleCount: 80,
    spread: 80,
    origin: { y: 0.55 },
    startVelocity: 40,
    colors,
    scalar: 0.9,
    ticks: 180,
    gravity: 0.9,
  });
}
