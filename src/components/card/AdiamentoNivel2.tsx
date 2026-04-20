'use client';

import type { SugestaoAdiamento } from '@/lib/adiamento/heuristica';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CalendarPlus,
  ChevronDown,
  Moon,
  Sparkles,
  Sun,
  Sunrise,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type SwipeDir, SwipeHandler } from './SwipeHandler';

interface AdiamentoNivel2Props {
  sugestao?: SugestaoAdiamento | null;
  onEscolher: (ate: Date, motivo: string) => void;
  onCancelar: () => void;
}

interface Preset {
  id: string;
  rotulo: string;
  relativo: string;
  icon: React.ElementType;
  alvo: () => Date;
  motivo: string;
}

function getProximoTurno(): Date {
  const agora = new Date();
  const hora = agora.getHours();
  const d = new Date(agora);
  if (hora < 14) {
    d.setHours(14, 0, 0, 0);
  } else if (hora < 19) {
    d.setHours(19, 0, 0, 0);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

function rotuloProximoTurno(): string {
  const hora = new Date().getHours();
  if (hora < 14) return 'Hoje à tarde';
  if (hora < 19) return 'Hoje à noite';
  return 'Amanhã cedo';
}

function defaultDatetime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildPresets(): Preset[] {
  const agora = new Date();

  const proximoTurno = getProximoTurno();

  const hojeNoite = new Date(agora);
  hojeNoite.setHours(19, 0, 0, 0);
  if (hojeNoite <= agora) hojeNoite.setDate(hojeNoite.getDate() + 1);

  const amanhaCedo = new Date(agora);
  amanhaCedo.setDate(amanhaCedo.getDate() + 1);
  amanhaCedo.setHours(9, 0, 0, 0);

  const proximaSeg = new Date(agora);
  const diasAteSegunda = (8 - proximaSeg.getDay()) % 7 || 7;
  proximaSeg.setDate(proximaSeg.getDate() + diasAteSegunda);
  proximaSeg.setHours(9, 0, 0, 0);

  const deltaH = (d: Date) => Math.round((d.getTime() - agora.getTime()) / 3_600_000);

  const fmt = (d: Date) => {
    const h = deltaH(d);
    if (h < 2) return 'em 1h';
    if (h < 24) return `em ${h}h`;
    const dias = Math.round(h / 24);
    if (dias === 1) return 'amanhã';
    return `em ${dias} dias`;
  };

  return [
    {
      id: 'proximoTurno',
      rotulo: rotuloProximoTurno(),
      relativo: fmt(proximoTurno),
      icon: Zap,
      alvo: () => getProximoTurno(),
      motivo: `preset: ${rotuloProximoTurno().toLowerCase()}`,
    },
    {
      id: 'hojeTarde',
      rotulo: 'Hoje à tarde',
      relativo: fmt((() => { const d = new Date(); d.setHours(14,0,0,0); if (d <= agora) d.setDate(d.getDate()+1); return d; })()),
      icon: Sun,
      alvo: () => {
        const d = new Date();
        d.setHours(14, 0, 0, 0);
        if (d <= new Date()) d.setDate(d.getDate() + 1);
        return d;
      },
      motivo: 'preset: hoje à tarde 14h',
    },
    {
      id: 'hojeNoite',
      rotulo: 'Hoje à noite',
      relativo: fmt(hojeNoite),
      icon: Moon,
      alvo: () => {
        const d = new Date();
        d.setHours(19, 0, 0, 0);
        if (d <= new Date()) d.setDate(d.getDate() + 1);
        return d;
      },
      motivo: 'preset: hoje à noite 19h',
    },
    {
      id: 'amanha',
      rotulo: 'Amanhã cedo',
      relativo: fmt(amanhaCedo),
      icon: Sunrise,
      alvo: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
      motivo: 'preset: amanhã 9h',
    },
    {
      id: 'semana',
      rotulo: 'Próxima semana',
      relativo: fmt(proximaSeg),
      icon: Calendar,
      alvo: () => {
        const d = new Date();
        const dias = (8 - d.getDay()) % 7 || 7;
        d.setDate(d.getDate() + dias);
        d.setHours(9, 0, 0, 0);
        return d;
      },
      motivo: 'preset: próxima segunda 9h',
    },
    {
      id: 'custom',
      rotulo: 'Data específica',
      relativo: 'escolher',
      icon: CalendarPlus,
      alvo: () => new Date(),
      motivo: 'custom picker',
    },
  ];
}

function formatarSugestao(iso: string): string {
  const d = new Date(iso);
  const agora = new Date();
  const diff = d.getTime() - agora.getTime();
  const h = Math.round(diff / 3_600_000);
  const diasDaSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const dia = diasDaSemana[d.getDay()];
  const hora = `${d.getHours().toString().padStart(2, '0')}h`;
  if (h < 24) return `hoje ${hora}`;
  if (h < 48) return `amanhã ${hora}`;
  return `${dia} ${hora}`;
}

function BarraConfianca({ valor }: { valor: number }) {
  const filled = Math.round(valor * 5);
  return (
    <div className="flex gap-1" aria-label={`Confiança: ${Math.round(valor * 100)}%`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 w-4 rounded-full transition-colors',
            i < filled ? 'bg-jade-accent' : 'bg-border-strong',
          )}
        />
      ))}
    </div>
  );
}

export function AdiamentoNivel2({ sugestao, onEscolher, onCancelar }: AdiamentoNivel2Props) {
  const [customAberto, setCustomAberto] = useState(false);
  const [datetime, setDatetime] = useState(defaultDatetime);
  const presets = buildPresets();

  // Refs para manter callbacks estáveis e evitar re-registrar listener
  const onEscolherRef = useRef(onEscolher);
  const onCancelarRef = useRef(onCancelar);
  useEffect(() => {
    onEscolherRef.current = onEscolher;
    onCancelarRef.current = onCancelar;
  }, [onEscolher, onCancelar]);

  // Listener de teclado dedicado ao overlay — registra uma única vez e captura
  // arrow keys ANTES do handler da página (useCapture=true).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      switch (e.key) {
        case 'ArrowLeft': {
          e.preventDefault();
          e.stopImmediatePropagation();
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(0, 0, 0, 0);
          onEscolherRef.current(d, 'teclado: amanhã sem horário');
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          e.stopImmediatePropagation();
          const d = new Date();
          d.setDate(d.getDate() + 1);
          onEscolherRef.current(d, 'teclado: amanhã mesmo horário');
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          e.stopImmediatePropagation();
          onEscolherRef.current(
            getProximoTurno(),
            `teclado: ${rotuloProximoTurno().toLowerCase()}`,
          );
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          e.stopImmediatePropagation();
          onCancelarRef.current();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          e.stopImmediatePropagation();
          onCancelarRef.current();
          break;
        }
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  const temSugestaoReal = !!sugestao && !sugestao.fallback;

  const handleSwipe = (dir: SwipeDir): void => {
    if (dir === 'left') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      onEscolher(d, 'swipe: amanhã sem horário');
    } else if (dir === 'right') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      onEscolher(d, 'swipe: amanhã mesmo horário');
    } else if (dir === 'up') {
      onEscolher(getProximoTurno(), `swipe: ${rotuloProximoTurno().toLowerCase()}`);
    } else if (dir === 'down') {
      onCancelar();
    }
  };

  const handlePreset = (p: Preset): void => {
    if (p.id === 'custom') {
      setCustomAberto((v) => !v);
      return;
    }
    onEscolher(p.alvo(), p.motivo);
  };

  const handleConfirmarCustom = (): void => {
    if (!datetime) return;
    onEscolher(new Date(datetime), 'custom picker');
  };

  const handleAceitarSugestao = (): void => {
    if (!sugestao) return;
    onEscolher(new Date(sugestao.ateISO), `sugestão IA: ${sugestao.motivo}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative h-full w-full"
    >
      <SwipeHandler onSwipe={handleSwipe}>
        <div className="grad-card flex h-full w-full flex-col gap-5 rounded-2xl border border-border-strong px-5 py-6">
          {/* Header */}
          <header className="space-y-0.5 text-center">
            <h2 className="text-lg font-semibold text-text-primary">Adiar para quando?</h2>
            <p className="text-xs text-text-secondary">
              ↑ {rotuloProximoTurno().toLowerCase()} · ← amanhã · → amanhã (mesma hora) · ↓ cancelar
            </p>
          </header>

          {/* Sugestão IA */}
          <AnimatePresence>
            {temSugestaoReal && sugestao && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22 }}
                className="rounded-xl border border-jade-accent bg-jade-dim/20 p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-jade-dim">
                    <Sparkles className="h-3.5 w-3.5 text-jade-accent" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-[11px] font-medium uppercase tracking-widest text-jade-accent">
                      TinDo sugere
                    </p>
                    <p className="text-base font-semibold text-text-primary">
                      {formatarSugestao(sugestao.ateISO)}
                    </p>
                    <p className="text-xs text-text-secondary line-clamp-2">{sugestao.motivo}</p>
                  </div>
                  <BarraConfianca valor={sugestao.confianca} />
                </div>

                <motion.button
                  type="button"
                  onClick={handleAceitarSugestao}
                  aria-label="Aceitar sugestão do TinDo"
                  className={cn(
                    'animate-pulse-jade w-full rounded-lg grad-jade py-2.5 text-sm font-semibold text-text-inverse',
                    'focus-visible:ring-2 focus-visible:ring-jade-accent focus-visible:outline-none',
                    'transition-opacity hover:opacity-90 active:opacity-80',
                  )}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Aceitar sugestão
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid de presets */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {presets.map((p, i) => {
              const Icon = p.icon;
              const isCustom = p.id === 'custom';
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  onClick={() => handlePreset(p)}
                  aria-label={`Adiar para: ${p.rotulo} (${p.relativo})`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  whileHover={{ scale: 1.02, boxShadow: '0 0 0 1px rgba(44,175,147,0.45)' }}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
                    isCustom
                      ? 'border-border-strong bg-bg-surface hover:border-jade-accent/50 hover:bg-bg-hover'
                      : 'border-border-strong bg-bg-surface hover:border-jade-accent/50 hover:bg-bg-hover',
                    isCustom && customAberto && 'border-jade-accent/60 bg-jade-dim/10',
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <Icon className="h-4 w-4 text-jade-accent" />
                    {isCustom && (
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 text-text-muted transition-transform duration-200',
                          customAberto && 'rotate-180',
                        )}
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary leading-tight">
                      {p.rotulo}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-secondary">{p.relativo}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Data custom — accordion */}
          <AnimatePresence>
            {customAberto && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 pt-1">
                  <input
                    id="custom-datetime"
                    type="datetime-local"
                    value={datetime}
                    onChange={(e) => setDatetime(e.target.value)}
                    aria-label="Data e hora personalizada para adiamento"
                    className={cn(
                      'h-11 flex-1 rounded-lg border border-border-strong bg-bg-surface px-3',
                      'text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
                    )}
                  />
                  <motion.button
                    type="button"
                    onClick={handleConfirmarCustom}
                    disabled={!datetime}
                    aria-label="Confirmar data e hora personalizada"
                    whileHover={datetime ? { scale: 1.02 } : {}}
                    whileTap={datetime ? { scale: 0.97 } : {}}
                    className={cn(
                      'h-11 rounded-lg px-4 text-sm font-semibold transition-opacity',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
                      datetime
                        ? 'grad-jade text-text-inverse hover:opacity-90'
                        : 'cursor-not-allowed bg-bg-surface text-text-muted opacity-40',
                    )}
                  >
                    Ok
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="mt-auto text-center">
            <button
              type="button"
              onClick={onCancelar}
              aria-label="Cancelar adiamento"
              className={cn(
                'text-sm text-text-muted transition-colors hover:text-text-secondary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent rounded px-2 py-1',
              )}
            >
              Cancelar
            </button>
          </div>
        </div>
      </SwipeHandler>
    </motion.div>
  );
}
