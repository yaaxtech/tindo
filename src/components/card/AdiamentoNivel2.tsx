'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { SwipeHandler, type SwipeDir } from './SwipeHandler';

interface AdiamentoNivel2Props {
  onEscolher: (ate: Date) => void;
  onCancelar: () => void;
}

function proximoTurno(): Date {
  const agora = new Date();
  const hora = agora.getHours();
  const alvo = new Date(agora);
  if (hora < 12) alvo.setHours(13, 0, 0, 0);
  else if (hora < 18) alvo.setHours(19, 0, 0, 0);
  else {
    alvo.setDate(alvo.getDate() + 1);
    alvo.setHours(8, 0, 0, 0);
  }
  return alvo;
}

function amanhaMesmoHorario(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

export function AdiamentoNivel2({ onEscolher, onCancelar }: AdiamentoNivel2Props) {
  const [datetime, setDatetime] = useState<string>('');

  const handleSwipe = (dir: SwipeDir): void => {
    // Convenção: esquerda = "próximo turno" (avança), direita = "amanhã mesmo horário" (volta ao mesmo).
    if (dir === 'left') onEscolher(proximoTurno());
    else if (dir === 'right') onEscolher(amanhaMesmoHorario());
    else if (dir === 'down') onCancelar();
    // up: não confirma — usuário usa o date-picker abaixo
  };

  const handleConfirmarCustom = (): void => {
    if (datetime) onEscolher(new Date(datetime));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative h-full w-full"
    >
      <SwipeHandler onSwipe={handleSwipe}>
        <div className="grad-card flex h-full w-full flex-col items-center justify-between rounded-xl border border-border-strong p-6 text-center">
          <header>
            <p className="text-xs uppercase tracking-widest text-text-muted">Adiar</p>
            <h2 className="mt-2 text-2xl font-semibold">Para quando?</h2>
          </header>

          <div className="grid w-full grid-cols-2 gap-3 text-sm">
            <Opcao titulo="← Próximo turno" />
            <Opcao titulo="Amanhã mesmo horário →" />
          </div>

          <div className="w-full space-y-2">
            <label className="text-xs uppercase tracking-wider text-text-muted" htmlFor="custom">
              ↑ Escolher específico
            </label>
            <input
              id="custom"
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="h-11 w-full rounded-md border border-border-strong bg-bg-surface px-3 text-text-primary"
            />
            <button
              type="button"
              onClick={handleConfirmarCustom}
              disabled={!datetime}
              className="h-10 w-full rounded-md grad-jade font-medium text-text-inverse disabled:opacity-40"
            >
              Confirmar horário
            </button>
          </div>

          <button
            type="button"
            onClick={onCancelar}
            className="text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            ↓ Cancelar (ESC)
          </button>
        </div>
      </SwipeHandler>
    </motion.div>
  );
}

function Opcao({ titulo }: { titulo: string }) {
  return (
    <div className="rounded-md border border-border-strong bg-bg-surface p-3 text-sm text-text-secondary">
      {titulo}
    </div>
  );
}
