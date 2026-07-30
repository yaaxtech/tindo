'use client';

// Estado do menu PRINCIPAL do TinDo em rotas imersivas (ex.: /docs). Fora do
// imersivo a Sidebar é fixa e não usa este store — ele só importa quando o
// menu vira gaveta (aberta pelo ☰ da topbar da rota, fechada por fora/Esc).

import { create } from 'zustand';

interface TinDoMenuState {
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
  alternar: () => void;
}

export const useTinDoMenuStore = create<TinDoMenuState>((set) => ({
  aberto: false,
  abrir: () => set({ aberto: true }),
  fechar: () => set({ aberto: false }),
  alternar: () => set((s) => ({ aberto: !s.aberto })),
}));
