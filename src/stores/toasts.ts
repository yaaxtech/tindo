'use client';

import { create } from 'zustand';

export interface Toast {
  id: string;
  titulo: string;
  descricao?: string;
  icone?: 'adiar' | 'info' | 'ok' | 'alerta';
  duracaoMs?: number;
  acao?: {
    label: string;
    onClick: () => void | Promise<void>;
  };
}

interface ToastState {
  lista: Toast[];
  push: (t: Omit<Toast, 'id'>) => string;
  remove: (id: string) => void;
  clear: () => void;
}

export const useToasts = create<ToastState>((set, get) => ({
  lista: [],
  push: (t) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: Toast = { duracaoMs: 5000, icone: 'info', ...t, id };
    set({ lista: [...get().lista, toast] });
    return id;
  },
  remove: (id) => set({ lista: get().lista.filter((t) => t.id !== id) }),
  clear: () => set({ lista: [] }),
}));
