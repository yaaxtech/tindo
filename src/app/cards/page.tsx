'use client';

import { CardStack } from '@/components/card/CardStack';
import { ContadorLembretes } from '@/components/card/ContadorLembretes';
import { EditarDataPopover } from '@/components/card/EditarDataPopover';
import type { SwipeDir } from '@/components/card/SwipeHandler';
import type { SalvarPayload } from '@/components/card/TarefaModal';
import type { CampoData } from '@/components/card/TaskCard';
import { TaskCard } from '@/components/card/TaskCard';
import { CompletionCelebration } from '@/components/celebration/CompletionCelebration';
import dynamic from 'next/dynamic';

// Dynamic imports pra reduzir bundle inicial (~40kb framer-motion + anim code)
const TarefaModal = dynamic(
  () => import('@/components/card/TarefaModal').then((m) => ({ default: m.TarefaModal })),
  { ssr: false, loading: () => null },
);
const AdiamentoNivel2 = dynamic(
  () => import('@/components/card/AdiamentoNivel2').then((m) => ({ default: m.AdiamentoNivel2 })),
  { ssr: false, loading: () => null },
);
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { type SugestaoAdiamento, rotuloMotivoManual } from '@/lib/adiamento/heuristica';
import { playCompletion, playLevelUp, playSwipe } from '@/lib/audio/tones';
import { mockTarefas } from '@/lib/mock/tarefas';
import { useCardStackStore } from '@/stores/cardStack';
import { useGamificacaoStore } from '@/stores/gamificacao';
import { useToasts } from '@/stores/toasts';
import type { Tarefa } from '@/types/domain';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function formatarQuando(ate: Date): string {
  const agora = new Date();
  const sameDay =
    ate.getFullYear() === agora.getFullYear() &&
    ate.getMonth() === agora.getMonth() &&
    ate.getDate() === agora.getDate();
  const amanha = new Date(agora);
  amanha.setDate(amanha.getDate() + 1);
  const isAmanha =
    ate.getFullYear() === amanha.getFullYear() &&
    ate.getMonth() === amanha.getMonth() &&
    ate.getDate() === amanha.getDate();
  const hora = ate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `hoje às ${hora}`;
  if (isAmanha) return `amanhã às ${hora}`;
  return ate.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CardsPage() {
  const router = useRouter();
  const {
    fila,
    setFila,
    atual,
    proxima,
    anterior,
    concluir,
    abrirNivel2Adiar,
    fecharNivel2Adiar,
    adiarAte,
    desfazerUltimoAdiamento,
    nivel2Adiar,
    removerAtual,
  } = useCardStackStore();
  const pushToast = useToasts((s) => s.push);
  const {
    streakAtual,
    nivel,
    progressoPercentual,
    hidratar: hidratarGami,
    registrarConclusao,
  } = useGamificacaoStore();
  const [celebrando, setCelebrando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [ultimoXp, setUltimoXp] = useState(10);
  const [modalAberto, setModalAberto] = useState<'editar' | 'criar' | null>(null);
  const [sugestaoNivel2, setSugestaoNivel2] = useState<SugestaoAdiamento | null>(null);
  const [projetosLite, setProjetosLite] = useState<{ id: string; nome: string; cor: string }[]>([]);
  const [tagsLite, setTagsLite] = useState<{ id: string; nome: string; cor: string }[]>([]);
  // Popover de edição de data inline
  const [popoverAberto, setPopoverAberto] = useState<CampoData | null>(null);
  // Animação de saída disparada pelo teclado
  const [animacaoEmCurso, setAnimacaoEmCurso] = useState<SwipeDir | null>(null);
  const tarefaAtual = atual();

  useEffect(() => {
    void hidratarGami();
    void (async () => {
      try {
        const [resP, resT] = await Promise.all([fetch('/api/projetos'), fetch('/api/tags')]);
        const bodyP = await resP.json();
        const bodyT = await resT.json();
        setProjetosLite(
          (bodyP.projetos ?? []).map((p: { id: string; nome: string; cor: string }) => ({
            id: p.id,
            nome: p.nome,
            cor: p.cor,
          })),
        );
        setTagsLite(
          (bodyT.tags ?? []).map((t: { id: string; nome: string; cor: string }) => ({
            id: t.id,
            nome: t.nome,
            cor: t.cor,
          })),
        );
      } catch {
        /* ignore */
      }
    })();
  }, [hidratarGami]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch('/api/fila', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { fila: filaReal } = (await res.json()) as { fila: Tarefa[] };
        if (cancelado) return;
        if (filaReal.length === 0) {
          setFila([...mockTarefas].sort((a, b) => b.nota - a.nota));
          setErroCarga('Sem tarefas reais — usando mock.');
        } else {
          setFila(filaReal);
        }
      } catch (e) {
        if (cancelado) return;
        console.error(e);
        setFila([...mockTarefas].sort((a, b) => b.nota - a.nota));
        setErroCarga(e instanceof Error ? e.message : 'Erro ao carregar');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sincronizarAcao(
    tarefaId: string,
    payload:
      | { tipo: 'concluir' }
      | { tipo: 'adiar'; ate: string; motivoAuto?: string; automatico?: boolean }
      | { tipo: 'desfazer_adiamento' }
      | { tipo: 'excluir' },
  ): Promise<void> {
    try {
      await fetch(`/api/tarefas/${tarefaId}/acao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('sincronizarAcao falhou (UI segue otimista):', e);
    }
  }

  async function buscarSugestao(tarefaId: string): Promise<SugestaoAdiamento | null> {
    try {
      const res = await fetch(`/api/adiamento/sugerir?tarefaId=${encodeURIComponent(tarefaId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { sugestao: SugestaoAdiamento };
      return body.sugestao ?? null;
    } catch {
      return null;
    }
  }

  function dispararToastAdiamento(tarefa: Tarefa, ate: Date, motivo: string): void {
    const labelQuando = formatarQuando(ate);
    pushToast({
      titulo: `Adiada para ${labelQuando}`,
      descricao: motivo,
      icone: 'adiar',
      duracaoMs: 5000,
      acao: {
        label: 'Desfazer',
        onClick: async () => {
          desfazerUltimoAdiamento();
          await sincronizarAcao(tarefa.id, { tipo: 'desfazer_adiamento' });
        },
      },
    });
  }

  const abrirNivel2ComSugestao = (): void => {
    const alvo = tarefaAtual;
    setSugestaoNivel2(null);
    abrirNivel2Adiar();
    if (!alvo) return;
    void (async () => {
      const s = await buscarSugestao(alvo.id);
      setSugestaoNivel2(s);
    })();
  };

  const handleSwipe = (dir: SwipeDir): void => {
    void playSwipe(dir);
    // Convenção final (2026-04-20): consistente mobile + teclado.
    // ← volta (anterior), → avança (próxima)
    if (dir === 'left') anterior();
    else if (dir === 'right') proxima();
    else if (dir === 'up') abrirNivel2ComSugestao();
    else if (dir === 'down') {
      const alvo = tarefaAtual;
      if (!alvo) return;
      void (async () => {
        const sugestao = await buscarSugestao(alvo.id);
        const ate = sugestao
          ? new Date(sugestao.ateISO)
          : (() => {
              const d = new Date();
              d.setHours(d.getHours() + 3);
              return d;
            })();
        const motivo = sugestao?.motivo ?? '+3h (fallback)';
        adiarAte(ate);
        void sincronizarAcao(alvo.id, {
          tipo: 'adiar',
          ate: ate.toISOString(),
          motivoAuto: motivo,
          automatico: true,
        });
        dispararToastAdiamento(alvo, ate, motivo);
      })();
    }
  };

  const handleConcluir = (): void => {
    if (!tarefaAtual) return;
    const { id, nota, tipo } = tarefaAtual;
    const xpEstimado = tipo === 'lembrete' ? 5 : 10 + Math.round(nota / 10);
    setUltimoXp(xpEstimado);
    setCelebrando(true);
    void playCompletion(streakAtual > 0);
    window.setTimeout(() => {
      concluir();
      void sincronizarAcao(id, { tipo: 'concluir' });
      void (async () => {
        const r = await registrarConclusao(id, tipo, nota);
        if (r?.subiuNivel) void playLevelUp();
      })();
    }, 600);
  };

  const handleAdiarManual = (ate: Date, motivoCustom?: string): void => {
    const atualTarefa = tarefaAtual;
    const motivo = motivoCustom ?? rotuloMotivoManual(ate);
    const automatico = motivo.startsWith('sugestão IA');
    adiarAte(ate);
    setSugestaoNivel2(null);
    if (atualTarefa) {
      void sincronizarAcao(atualTarefa.id, {
        tipo: 'adiar',
        ate: ate.toISOString(),
        motivoAuto: motivo,
        automatico,
      });
      dispararToastAdiamento(atualTarefa, ate, motivo);
    }
  };

  const handleExcluir = (): void => {
    if (!tarefaAtual) return;
    const id = tarefaAtual.id;
    removerAtual();
    void sincronizarAcao(id, { tipo: 'excluir' });
  };

  const salvarCampoData = (campo: CampoData, ate: string | null): void => {
    if (!tarefaAtual) return;
    const id = tarefaAtual.id;
    // Atualiza estado local otimista
    const filaAtualizada = fila.map((t: Tarefa) => {
      if (t.id !== id) return t;
      return campo === 'data_vencimento'
        ? { ...t, dataVencimento: ate }
        : { ...t, prazoConclusao: ate };
    });
    setFila(filaAtualizada);
    setPopoverAberto(null);
    // Persiste no backend e recalcula nota
    void fetch(`/api/tarefas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [campo]: ate }),
    }).catch((e) => console.error('salvarCampoData falhou:', e));
    pushToast({ titulo: 'Data atualizada', icone: 'ok', duracaoMs: 3000 });
  };

  // Dispara animação de saída e depois executa a ação (Tarefa 2)
  const dispararComAnimacao = (dir: SwipeDir): void => {
    if (!tarefaAtual || animacaoEmCurso) return;
    setAnimacaoEmCurso(dir);
    // handleSwipe é chamado internamente pelo SwipeHandler via onSwipe após animar
  };

  // Callback que o SwipeHandler chama após animação completar (ou no drag real)
  const handleSwipeComReset = (dir: SwipeDir): void => {
    setAnimacaoEmCurso(null);
    handleSwipe(dir);
  };

  useKeyboardNav({
    // Convenção consistente: tecla/swipe mesma direção.
    // ← = voltar (anterior), → = avançar (próxima)
    onLeft: () => !nivel2Adiar && !popoverAberto && dispararComAnimacao('left'),
    onRight: () => !nivel2Adiar && !popoverAberto && dispararComAnimacao('right'),
    onUp: () => !nivel2Adiar && !popoverAberto && abrirNivel2ComSugestao(),
    onDown: () => !nivel2Adiar && !popoverAberto && dispararComAnimacao('down'),
    onSpace: () => !nivel2Adiar && !popoverAberto && handleConcluir(),
    onEnter: () => !nivel2Adiar && !popoverAberto && handleConcluir(),
    onEscape: () => {
      if (popoverAberto) {
        setPopoverAberto(null);
        return;
      }
      if (nivel2Adiar) fecharNivel2Adiar();
    },
    onDelete: () => !nivel2Adiar && !popoverAberto && handleExcluir(),
    onNew: () => !nivel2Adiar && !popoverAberto && setModalAberto('criar'),
  });

  const pendentes = fila.filter((t: Tarefa) => t.status === 'pendente');
  const lembretesPendentes = pendentes.filter((t) => t.tipo === 'lembrete').length;

  return (
    <main className="relative flex min-h-dvh flex-col safe-top safe-bottom">
      <header className="flex items-center justify-between px-6 py-4 text-xs text-text-muted">
        <span className="flex flex-wrap items-center gap-2">
          <ContadorLembretes total={lembretesPendentes} />
          <span className="text-text-muted">·</span>
          <span>{pendentes.length} pendentes</span>
          {erroCarga && <span className="text-warning">· {erroCarga}</span>}
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full border border-jade-accent/40 bg-jade-dim/30 px-2.5 py-1 font-medium text-jade-accent"
            title={`Nível ${nivel} · ${progressoPercentual}% do próximo`}
          >
            ⚡ N{nivel}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-bg-elevated px-3 py-1 font-medium text-jade-accent"
            title="Streak (dias consecutivos com ao menos 1 conclusão)"
          >
            🔥 {streakAtual}
          </span>
        </span>
      </header>

      <section className="relative flex flex-1 items-center justify-center px-4 pb-6">
        <div className="relative h-[640px] w-full max-w-md md:h-[680px]">
          <AnimatePresence mode="wait">
            {carregando ? (
              <motion.div
                key="loading"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="h-12 w-12 animate-pulse-jade rounded-full bg-jade" />
              </motion.div>
            ) : tarefaAtual ? (
              <CardStack
                key="cardstack"
                fila={fila.filter((t: Tarefa) => t.status === 'pendente')}
                indice={fila
                  .filter((t: Tarefa) => t.status === 'pendente')
                  .findIndex((t) => t.id === tarefaAtual.id)}
                animacaoEmCurso={animacaoEmCurso}
                onSwipe={handleSwipeComReset}
                renderCard={(tarefa, posicao) => (
                  <>
                    <TaskCard
                      tarefa={tarefa}
                      onConcluir={posicao === 'topo' ? handleConcluir : () => {}}
                      onExcluir={posicao === 'topo' ? handleExcluir : () => {}}
                      onEditar={posicao === 'topo' ? () => setModalAberto('editar') : () => {}}
                      onDependencia={() => {}}
                      onAdicionar={posicao === 'topo' ? () => setModalAberto('criar') : () => {}}
                      onListar={posicao === 'topo' ? () => router.push('/tarefas') : () => {}}
                      onSalvarData={
                        posicao === 'topo' ? (campo) => setPopoverAberto(campo) : undefined
                      }
                    />
                    {posicao === 'topo' && (
                      <EditarDataPopover
                        aberto={popoverAberto !== null}
                        label={
                          popoverAberto === 'data_vencimento'
                            ? 'Data de vencimento'
                            : 'Prazo de conclusão'
                        }
                        valorInicial={
                          popoverAberto === 'data_vencimento'
                            ? (tarefa.dataVencimento?.slice(0, 10) ?? null)
                            : (tarefa.prazoConclusao?.slice(0, 10) ?? null)
                        }
                        onFechar={() => setPopoverAberto(null)}
                        onSalvar={(ate) => {
                          if (popoverAberto) salvarCampoData(popoverAberto, ate);
                        }}
                      />
                    )}
                  </>
                )}
              />
            ) : (
              <motion.div
                key="empty"
                className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-border-strong bg-bg-elevated p-8 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full grad-jade">
                  🌿
                </div>
                <h2 className="text-xl font-semibold">Tudo feito por agora</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Sincronize com Todoist ou adicione uma tarefa nova.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {nivel2Adiar && (
              <motion.div
                key="nivel2"
                className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <div className="w-full max-w-md">
                  <AdiamentoNivel2
                    sugestao={sugestaoNivel2}
                    onEscolher={handleAdiarManual}
                    onCancelar={() => {
                      setSugestaoNivel2(null);
                      fecharNivel2Adiar();
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <CompletionCelebration
            visivel={celebrando}
            xpGanho={ultimoXp}
            onFim={() => setCelebrando(false)}
          />
        </div>
      </section>

      <TarefaModal
        aberto={modalAberto !== null}
        modo={modalAberto ?? 'criar'}
        onFechar={() => setModalAberto(null)}
        tarefa={modalAberto === 'editar' && tarefaAtual ? tarefaAtual : undefined}
        projetos={projetosLite}
        tags={tagsLite}
        onSalvar={async (payload: SalvarPayload) => {
          if (modalAberto === 'editar' && tarefaAtual) {
            await fetch(`/api/tarefas/${tarefaAtual.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          } else {
            await fetch('/api/tarefas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          }
          // Recarrega fila
          try {
            const res = await fetch('/api/fila', { cache: 'no-store' });
            const body = await res.json();
            setFila(body.fila);
          } catch {
            /* ignore */
          }
        }}
      />
    </main>
  );
}
