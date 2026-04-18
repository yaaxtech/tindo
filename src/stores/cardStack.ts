'use client';

import { create } from 'zustand';
import type { Tarefa } from '@/types/domain';

interface CardStackState {
  fila: Tarefa[];
  indice: number;
  historico: string[];
  nivel2Adiar: boolean;
  setFila: (t: Tarefa[]) => void;
  proxima: () => Tarefa | null;
  anterior: () => Tarefa | null;
  atual: () => Tarefa | null;
  concluir: () => Tarefa | null;
  removerAtual: () => Tarefa | null;
  abrirNivel2Adiar: () => void;
  fecharNivel2Adiar: () => void;
  adiarAte: (ate: Date) => Tarefa | null;
  reset: () => void;
}

export const useCardStackStore = create<CardStackState>((set, get) => ({
  fila: [],
  indice: 0,
  historico: [],
  nivel2Adiar: false,

  setFila: (t) => set({ fila: t, indice: 0, historico: [] }),

  atual: () => {
    const { fila, indice } = get();
    return fila[indice] ?? null;
  },

  proxima: () => {
    const { fila, indice, historico } = get();
    const atual = fila[indice];
    const proxIdx = Math.min(indice + 1, fila.length);
    set({
      indice: proxIdx,
      historico: atual ? [...historico, atual.id] : historico,
    });
    return fila[proxIdx] ?? null;
  },

  anterior: () => {
    const { fila, indice, historico } = get();
    if (historico.length === 0 || indice === 0) return null;
    const novoIdx = Math.max(0, indice - 1);
    set({ indice: novoIdx, historico: historico.slice(0, -1) });
    return fila[novoIdx] ?? null;
  },

  concluir: () => {
    const { fila, indice } = get();
    const atual = fila[indice];
    if (!atual) return null;
    const novaFila = fila.filter((t) => t.id !== atual.id);
    const novoIdx = Math.min(indice, Math.max(0, novaFila.length - 1));
    set({ fila: novaFila, indice: novoIdx });
    return novaFila[novoIdx] ?? null;
  },

  removerAtual: () => {
    const { fila, indice } = get();
    const atual = fila[indice];
    if (!atual) return null;
    const novaFila = fila.filter((t) => t.id !== atual.id);
    const novoIdx = Math.min(indice, Math.max(0, novaFila.length - 1));
    set({ fila: novaFila, indice: novoIdx });
    return novaFila[novoIdx] ?? null;
  },

  abrirNivel2Adiar: () => set({ nivel2Adiar: true }),
  fecharNivel2Adiar: () => set({ nivel2Adiar: false }),

  adiarAte: (ate) => {
    const { fila, indice } = get();
    const atual = fila[indice];
    if (!atual) return null;
    const atualizada: Tarefa = {
      ...atual,
      adiadaAte: ate.toISOString(),
      adiamentoCount: atual.adiamentoCount + 1,
    };
    const novaFila = fila.map((t) => (t.id === atual.id ? atualizada : t)).filter((t) => t.id !== atual.id);
    set({ fila: novaFila, indice: Math.min(indice, Math.max(0, novaFila.length - 1)), nivel2Adiar: false });
    return novaFila[Math.min(indice, Math.max(0, novaFila.length - 1))] ?? null;
  },

  reset: () => set({ fila: [], indice: 0, historico: [], nivel2Adiar: false }),
}));
