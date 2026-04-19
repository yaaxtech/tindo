'use client';

/**
 * Banner flutuante que aparece quando KPIs disparam gatilho de recalibração.
 * Auto-dismissível com TTL de 24h via localStorage.
 * Chama /api/recalibrar/gatilhos silenciosamente no mount.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const DISMISS_KEY = 'recalibracao_banner_dismissed_at';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function isDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < TTL_MS;
  } catch {
    return false;
  }
}

function saveDismiss(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // silencioso
  }
}

export function RecalibracaoBanner() {
  const [visivel, setVisivel] = useState(false);
  const [motivo, setMotivo] = useState<string>('');
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    if (isDismissed()) return;

    void (async () => {
      try {
        const res = await fetch('/api/recalibrar/gatilhos', {
          // usa cache de no-store para sempre pegar resultado fresco
          cache: 'no-store',
          // timeout manual via AbortController
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          deveRecalibrar: boolean;
          gatilhos: Array<{ label: string }>;
        };
        if (data.deveRecalibrar) {
          setMotivo(data.gatilhos.map((g) => g.label).join(' · '));
          setVisivel(true);
        }
      } catch {
        // silencioso — não bloqueia UI
      }
    })();
  }, []);

  const fechar = () => {
    saveDismiss();
    setVisivel(false);
  };

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="fixed top-4 right-4 z-50 max-w-xs w-full"
          role="alert"
          aria-live="polite"
        >
          <div className="rounded-2xl border border-[var(--jade-primary)]/40 bg-[var(--bg-elevated)] shadow-xl shadow-black/30 p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-full p-1.5 bg-[var(--jade-dim)]/40 mt-0.5">
                <AlertTriangle size={14} className="text-[var(--jade-accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">
                  Hora de recalibrar
                </p>
                {motivo && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate" title={motivo}>
                    {motivo}
                  </p>
                )}
                <Link
                  href="/recalibrar"
                  onClick={fechar}
                  className="mt-2 inline-flex items-center text-xs font-medium text-[var(--jade-accent)] hover:underline"
                >
                  Recalibrar agora →
                </Link>
              </div>
              <button
                onClick={fechar}
                aria-label="Fechar aviso de recalibração"
                className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
