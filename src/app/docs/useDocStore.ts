'use client';

// RoadMapMind — estado da TELA (Zustand): modo de visualização, divisor,
// orientação do mapa, foco e seleção. Nada aqui toca dados — persistência
// vive em src/services/doc.ts (via /api/docs).

import { create } from 'zustand';

export type ModoTela = 'doc' | 'split' | 'mapa';
export type Orientacao = 'horizontal' | 'vertical';

interface DocStore {
  /** Painéis visíveis: só documento, lado a lado ou só mapa. */
  modo: ModoTela;
  /** Largura do painel do editor no modo lado a lado (% da janela). */
  larguraEditor: number;
  /** Direção do mapa: esquerda→direita ou cima→baixo. */
  orientacao: Orientacao;
  /** Zoom do mapa acompanha o nó em edição no editor. */
  focoEdicao: boolean;
  /** Documento em foco (isola a subárvore). null = raiz do usuário. */
  focoId: string | null;
  /** Linha onde o cursor do editor está (sincronia editor→mapa). */
  cursorId: string | null;
  /** Cores custom das guias/níveis (painel 🎨). null = paleta automática. */
  coresCustom: string[] | null;
  setModo: (modo: ModoTela) => void;
  setLarguraEditor: (pct: number) => void;
  alternarOrientacao: () => void;
  alternarFocoEdicao: () => void;
  setFocoId: (id: string | null) => void;
  setCursorId: (id: string | null) => void;
  setCoresCustom: (cores: string[] | null) => void;
}

export const useDocStore = create<DocStore>((set) => ({
  modo: 'split',
  larguraEditor: 55,
  orientacao: 'horizontal',
  focoEdicao: false,
  focoId: null,
  cursorId: null,
  coresCustom: null,
  setModo: (modo) => set({ modo }),
  setLarguraEditor: (larguraEditor) => set({ larguraEditor }),
  alternarOrientacao: () =>
    set((s) => ({ orientacao: s.orientacao === 'horizontal' ? 'vertical' : 'horizontal' })),
  alternarFocoEdicao: () => set((s) => ({ focoEdicao: !s.focoEdicao })),
  setFocoId: (focoId) => set({ focoId }),
  setCursorId: (cursorId) => set({ cursorId }),
  setCoresCustom: (coresCustom) => set({ coresCustom }),
}));
