'use client';

import { create } from 'zustand';

interface GamificacaoState {
  xpTotal: number;
  nivel: number;
  streakAtual: number;
  streakRecorde: number;
  tarefasConcluidasTotal: number;
  lembretesConcluidosTotal: number;
  xpNoNivelAtual: number;
  xpParaProximoNivel: number;
  progressoPercentual: number;
  hidratar: () => Promise<void>;
  registrarConclusao: (tarefaId: string, tipo: 'tarefa' | 'lembrete', nota: number) => Promise<{
    xpGanho: number;
    subiuNivel: boolean;
    quebrouRecorde: boolean;
  } | null>;
}

export const useGamificacaoStore = create<GamificacaoState>((set) => ({
  xpTotal: 0,
  nivel: 1,
  streakAtual: 0,
  streakRecorde: 0,
  tarefasConcluidasTotal: 0,
  lembretesConcluidosTotal: 0,
  xpNoNivelAtual: 0,
  xpParaProximoNivel: 50,
  progressoPercentual: 0,

  hidratar: async () => {
    try {
      const res = await fetch('/api/gamificacao', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok || !body.gamificacao) return;
      set({
        xpTotal: body.gamificacao.xpTotal,
        nivel: body.gamificacao.nivel,
        streakAtual: body.gamificacao.streakAtual,
        streakRecorde: body.gamificacao.streakRecorde,
        tarefasConcluidasTotal: body.gamificacao.tarefasConcluidasTotal,
        lembretesConcluidosTotal: body.gamificacao.lembretesConcluidosTotal,
        xpNoNivelAtual: body.progresso.xpNoNivelAtual,
        xpParaProximoNivel: body.progresso.xpParaProximoNivel,
        progressoPercentual: body.progresso.progressoPercentual,
      });
    } catch (e) {
      console.error('hidratar gamificacao:', e);
    }
  },

  registrarConclusao: async (tarefaId, tipo, nota) => {
    try {
      const res = await fetch('/api/gamificacao/conclusao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarefaId, tipo, nota }),
      });
      const body = await res.json();
      if (!res.ok) return null;
      // Refresh dos campos
      set((s) => ({
        xpTotal: s.xpTotal + body.xpGanho,
        nivel: body.nivel,
        streakAtual: body.streakAtual,
        streakRecorde: body.quebrouRecorde ? body.streakAtual : s.streakRecorde,
      }));
      return {
        xpGanho: body.xpGanho,
        subiuNivel: body.subiuNivel,
        quebrouRecorde: body.quebrouRecorde,
      };
    } catch (e) {
      console.error('registrarConclusao:', e);
      return null;
    }
  },
}));
