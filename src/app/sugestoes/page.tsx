'use client';

import { SwipeHandler } from '@/components/card/SwipeHandler';
import { cn } from '@/lib/utils';
import { useToasts } from '@/stores/toasts';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Pencil, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SugestaoItem {
  id: string;
  titulo: string;
  descricao?: string | null;
  projeto_id_sugerido?: string | null;
  projetoNome?: string | null;
  importancia: number;
  urgencia: number;
  facilidade: number;
  razao: string;
}

interface EditFormState {
  titulo: string;
  descricao: string;
  importancia: number;
  urgencia: number;
  facilidade: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number): number {
  return Math.round(Math.min(100, Math.max(0, v)));
}

function MiniBar({ valor, cor }: { valor: number; cor: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-surface">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${valor}%` }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="h-full rounded-full"
        style={{ backgroundColor: cor }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditModal
// ---------------------------------------------------------------------------

interface EditModalProps {
  sugestao: SugestaoItem;
  onConfirmar: (dados: EditFormState) => void;
  onCancelar: () => void;
}

function EditModal({ sugestao, onConfirmar, onCancelar }: EditModalProps) {
  const [form, setForm] = useState<EditFormState>({
    titulo: sugestao.titulo,
    descricao: sugestao.descricao ?? '',
    importancia: sugestao.importancia,
    urgencia: sugestao.urgencia,
    facilidade: sugestao.facilidade,
  });

  const atualizar = <K extends keyof EditFormState>(k: K, v: EditFormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-safe-bottom sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Overlay */}
      <motion.div
        className="absolute inset-0 bg-bg-deep/80 backdrop-blur-sm"
        onClick={onCancelar}
      />
      {/* Sheet */}
      <motion.div
        className="relative z-10 w-full max-w-md rounded-2xl border border-border-strong bg-bg-elevated p-6 shadow-2xl"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <h2 className="mb-4 text-base font-semibold text-text-primary">Editar antes de criar</h2>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="edit-titulo"
              className="mb-1 block text-xs font-medium text-text-secondary"
            >
              Título
            </label>
            <input
              id="edit-titulo"
              type="text"
              value={form.titulo}
              onChange={(e) => atualizar('titulo', e.target.value)}
              maxLength={80}
              className={cn(
                'h-10 w-full rounded-lg border border-border-strong bg-bg-surface px-3 text-sm text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
              )}
            />
          </div>

          <div>
            <label
              htmlFor="edit-descricao"
              className="mb-1 block text-xs font-medium text-text-secondary"
            >
              Descrição (opcional)
            </label>
            <textarea
              id="edit-descricao"
              value={form.descricao}
              onChange={(e) => atualizar('descricao', e.target.value)}
              maxLength={200}
              rows={2}
              className={cn(
                'w-full resize-none rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
              )}
            />
          </div>

          {/* Sliders */}
          {(
            [
              { key: 'importancia', label: 'Importância', cor: '#2caf93' },
              { key: 'urgencia', label: 'Urgência', cor: '#f2b94b' },
              { key: 'facilidade', label: 'Facilidade', cor: '#6aa9e6' },
            ] as const
          ).map(({ key, label, cor }) => (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">{label}</span>
                <span className="font-mono text-xs text-text-muted">{form[key]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={form[key]}
                onChange={(e) => atualizar(key, Number(e.target.value))}
                className="w-full"
                style={{ accentColor: cor }}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className={cn(
              'flex-1 rounded-lg border border-border-strong py-2.5 text-sm text-text-secondary transition-colors',
              'hover:border-text-muted hover:text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
            )}
          >
            Cancelar
          </button>
          <motion.button
            type="button"
            onClick={() => onConfirmar(form)}
            disabled={!form.titulo.trim()}
            whileHover={form.titulo.trim() ? { scale: 1.02 } : {}}
            whileTap={form.titulo.trim() ? { scale: 0.97 } : {}}
            className={cn(
              'flex-1 rounded-lg py-2.5 text-sm font-semibold transition-opacity',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
              form.titulo.trim()
                ? 'grad-jade text-text-inverse hover:opacity-90'
                : 'cursor-not-allowed bg-bg-surface text-text-muted opacity-40',
            )}
          >
            Criar tarefa
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SugestaoCard
// ---------------------------------------------------------------------------

interface SugestaoCardProps {
  sugestao: SugestaoItem;
  isTop: boolean;
  stackIndex: number; // 0 = top, 1 = second, 2 = third
  onAceitar: () => void;
  onRejeitar: () => void;
  onEditar: () => void;
  isProcessing: boolean;
}

function SugestaoCard({
  sugestao,
  isTop,
  stackIndex,
  onAceitar,
  onRejeitar,
  onEditar,
  isProcessing,
}: SugestaoCardProps) {
  const scale = 1 - stackIndex * 0.05;
  const yOffset = stackIndex * 10;
  const opacity = 1 - stackIndex * 0.25;

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - stackIndex }}
      initial={isTop ? { scale, y: yOffset, opacity } : { scale, y: yOffset, opacity }}
      animate={{ scale, y: yOffset, opacity }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {isTop ? (
        <SwipeHandler
          onSwipe={(dir) => {
            if (isProcessing) return;
            if (dir === 'right') onAceitar();
            else if (dir === 'left') onRejeitar();
            else if (dir === 'up') onEditar();
          }}
          disabled={isProcessing}
        >
          <CardInner sugestao={sugestao} isTop={isTop} />
        </SwipeHandler>
      ) : (
        <CardInner sugestao={sugestao} isTop={false} />
      )}
    </motion.div>
  );
}

function CardInner({ sugestao, isTop }: { sugestao: SugestaoItem; isTop: boolean }) {
  return (
    <div
      className={cn(
        'grad-card h-full w-full select-none rounded-2xl border border-border-strong p-6',
        'flex flex-col gap-4',
        isTop && 'shadow-2xl',
      )}
    >
      {/* Ícone IA */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-jade-dim/30 border border-jade-accent/30">
          <Sparkles className="h-4 w-4 text-jade-accent" aria-hidden />
        </div>
        <span className="text-xs font-medium text-jade-accent">Sugestão IA</span>
        {sugestao.projetoNome && (
          <span className="ml-auto rounded-full border border-jade-accent/30 bg-jade-dim/20 px-2 py-0.5 text-xs text-jade-accent">
            {sugestao.projetoNome}
          </span>
        )}
      </div>

      {/* Título + Descrição */}
      <div className="flex-1 space-y-2">
        <h3 className="text-xl font-semibold leading-snug text-text-primary">{sugestao.titulo}</h3>
        {sugestao.descricao && (
          <p className="text-sm leading-relaxed text-text-secondary">{sugestao.descricao}</p>
        )}
      </div>

      {/* Razão caminho crítico */}
      <div className="rounded-xl border border-jade-accent/25 bg-jade-dim/20 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-jade-accent mb-1">
          Por que é crítico
        </p>
        <p className="text-sm leading-relaxed text-text-primary">{sugestao.razao}</p>
      </div>

      {/* Mini-barras I/U/F */}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { label: 'Importância', valor: sugestao.importancia, cor: '#2caf93' },
            { label: 'Urgência', valor: sugestao.urgencia, cor: '#f2b94b' },
            { label: 'Facilidade', valor: sugestao.facilidade, cor: '#6aa9e6' },
          ] as const
        ).map(({ label, valor, cor }) => (
          <div key={label} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-muted">{label.slice(0, 3)}</span>
              <span className="font-mono text-[10px] text-text-muted">{valor}</span>
            </div>
            <MiniBar valor={valor} cor={cor} />
          </div>
        ))}
      </div>

      {/* Dica swipe */}
      {isTop && (
        <p className="text-center text-[11px] text-text-muted">← Rejeitar · → Aceitar · ↑ Editar</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SugestoesPage() {
  const [sugestoes, setSugestoes] = useState<SugestaoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [aceitas, setAceitas] = useState(0);
  const [rejeitadas, setRejeitadas] = useState(0);
  const [editando, setEditando] = useState<SugestaoItem | null>(null);
  const [saiuPara, setSaiuPara] = useState<'left' | 'right' | null>(null);
  const toast = useToasts((s) => s.push);
  const iniciouFetch = useRef(false);

  const carregarPendentes = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch('/api/ai/sugerir-tarefas');
      const body = (await res.json()) as {
        sugestoes: Array<{ id: string; payload: Record<string, unknown>; createdAt: string }>;
      };
      const items: SugestaoItem[] = (body.sugestoes ?? []).map((s) => ({
        id: s.id,
        titulo: String(s.payload?.titulo ?? ''),
        descricao: s.payload?.descricao ? String(s.payload.descricao) : null,
        projeto_id_sugerido: s.payload?.projeto_id_sugerido
          ? String(s.payload.projeto_id_sugerido)
          : null,
        projetoNome: null,
        importancia: Number(s.payload?.importancia ?? 50),
        urgencia: Number(s.payload?.urgencia ?? 50),
        facilidade: Number(s.payload?.facilidade ?? 50),
        razao: String(s.payload?.razao_caminho_critico ?? ''),
      }));
      setSugestoes(items);
    } catch {
      toast({ titulo: 'Erro ao carregar sugestões', icone: 'alerta' });
    } finally {
      setCarregando(false);
    }
  }, [toast]);

  useEffect(() => {
    if (iniciouFetch.current) return;
    iniciouFetch.current = true;
    void carregarPendentes();
  }, [carregarPendentes]);

  // Teclado
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (editando || processando || sugestoes.length === 0) return;
      if (e.key === 'ArrowRight') handleAceitar();
      else if (e.key === 'ArrowLeft') handleRejeitar();
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const s = sugestoes[0];
        if (s) setEditando(s);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  const gerarNovas = async () => {
    setGerando(true);
    try {
      const res = await fetch('/api/ai/sugerir-tarefas', { method: 'POST' });
      const body = (await res.json()) as {
        sugestoes?: Array<{
          id: string;
          titulo: string;
          descricao?: string | null;
          importancia: number;
          urgencia: number;
          facilidade: number;
          razao: string;
        }>;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? 'Erro ao gerar.');
      const novas: SugestaoItem[] = (body.sugestoes ?? []).map((s) => ({
        id: s.id,
        titulo: s.titulo,
        descricao: s.descricao ?? null,
        projeto_id_sugerido: null,
        projetoNome: null,
        importancia: s.importancia,
        urgencia: s.urgencia,
        facilidade: s.facilidade,
        razao: s.razao,
      }));
      setSugestoes((prev) => [...novas, ...prev]);
      toast({ titulo: `${novas.length} sugestão(ões) gerada(s)`, icone: 'ok' });
    } catch (err) {
      toast({
        titulo: 'Erro ao gerar sugestões',
        descricao: err instanceof Error ? err.message : undefined,
        icone: 'alerta',
      });
    } finally {
      setGerando(false);
    }
  };

  const responder = async (id: string, acao: 'aceitar' | 'rejeitar', editada?: EditFormState) => {
    setProcessando(true);
    try {
      const res = await fetch(`/api/ai/sugerir-tarefas/${id}/resposta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, editada }),
      });
      const body = (await res.json()) as { ok?: boolean; tarefaId?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Erro');

      setSugestoes((prev) => prev.filter((s) => s.id !== id));

      if (acao === 'aceitar') {
        setAceitas((n) => n + 1);
        toast({
          titulo: 'Tarefa criada!',
          descricao: 'Adicionada à sua fila de tarefas.',
          icone: 'ok',
          acao: body.tarefaId
            ? {
                label: 'Abrir',
                onClick: () => {
                  window.location.href = `/tarefas/${body.tarefaId}`;
                },
              }
            : undefined,
        });
      } else {
        setRejeitadas((n) => n + 1);
        toast({ titulo: 'Sugestão descartada — aprendendo', icone: 'info' });
      }
    } catch (err) {
      toast({
        titulo: 'Erro ao responder',
        descricao: err instanceof Error ? err.message : undefined,
        icone: 'alerta',
      });
    } finally {
      setProcessando(false);
      setSaiuPara(null);
    }
  };

  const handleAceitar = () => {
    if (!sugestoes[0] || processando) return;
    setSaiuPara('right');
    void responder(sugestoes[0].id, 'aceitar');
  };

  const handleRejeitar = () => {
    if (!sugestoes[0] || processando) return;
    setSaiuPara('left');
    void responder(sugestoes[0].id, 'rejeitar');
  };

  const handleEditarConfirmar = (dados: EditFormState) => {
    if (!editando || processando) return;
    const id = editando.id;
    setEditando(null);
    setSaiuPara('right');
    void responder(id, 'aceitar', dados);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex min-h-dvh flex-col bg-bg-deep pt-safe-top">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Caminho Crítico</h1>
          <p className="text-xs text-text-muted">
            {carregando
              ? 'Carregando...'
              : sugestoes.length === 0
                ? 'Fila vazia'
                : `${sugestoes.length} sugestão(ões) restante(s)`}
          </p>
        </div>
        <motion.button
          type="button"
          onClick={() => void gerarNovas()}
          disabled={gerando || carregando}
          aria-label="Gerar novas sugestões com IA"
          whileHover={!gerando && !carregando ? { scale: 1.04 } : {}}
          whileTap={!gerando && !carregando ? { scale: 0.96 } : {}}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-opacity',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
            gerando || carregando
              ? 'cursor-not-allowed opacity-50 bg-bg-surface text-text-muted'
              : sugestoes.length === 0
                ? 'animate-pulse-jade grad-jade text-text-inverse'
                : 'border border-jade-accent/40 text-jade-accent hover:bg-jade-dim/20',
          )}
        >
          {gerando ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
              className="h-4 w-4 rounded-full border-2 border-jade-accent border-t-transparent"
            />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {gerando ? 'Gerando...' : 'Gerar novas'}
        </motion.button>
      </header>

      {/* Área do card */}
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-4 lg:max-w-lg">
        {carregando ? (
          <div className="flex flex-1 items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
              className="h-8 w-8 rounded-full border-2 border-jade-accent border-t-transparent"
            />
          </div>
        ) : sugestoes.length === 0 ? (
          /* Empty state */
          <motion.div
            className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-jade-dim/20 border border-jade-accent/20">
              <Sparkles className="h-10 w-10 text-jade-accent" aria-hidden />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-text-primary">Nenhuma sugestão pendente</h2>
              <p className="text-sm text-text-secondary">
                Gere novas sugestões para descobrir o próximo passo crítico.
              </p>
            </div>
            <motion.button
              type="button"
              onClick={() => void gerarNovas()}
              disabled={gerando}
              aria-label="Gerar sugestões com IA"
              whileHover={!gerando ? { scale: 1.03 } : {}}
              whileTap={!gerando ? { scale: 0.97 } : {}}
              className={cn(
                'animate-pulse-jade grad-jade rounded-xl px-6 py-3 text-sm font-semibold text-text-inverse',
                'flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
                gerando && 'cursor-not-allowed opacity-60',
              )}
            >
              {gerando ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
                  className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              Gerar sugestões com IA
            </motion.button>
          </motion.div>
        ) : (
          /* Stack de cards */
          <div className="relative flex flex-1 flex-col">
            {/* Stack */}
            <div className="relative flex-1" style={{ minHeight: 420 }}>
              <AnimatePresence mode="popLayout">
                {sugestoes.slice(0, 3).map((s, idx) => {
                  const isTop = idx === 0;
                  return (
                    <AnimatePresence key={s.id} mode="sync">
                      {isTop && saiuPara ? (
                        <motion.div
                          key={`${s.id}-exit`}
                          className="absolute inset-0"
                          style={{ zIndex: 10 }}
                          initial={{ x: 0, opacity: 1 }}
                          animate={{
                            x: saiuPara === 'right' ? 400 : -400,
                            opacity: 0,
                            rotate: saiuPara === 'right' ? 15 : -15,
                          }}
                          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                        >
                          <CardInner sugestao={s} isTop />
                        </motion.div>
                      ) : (
                        <SugestaoCard
                          key={s.id}
                          sugestao={s}
                          isTop={isTop}
                          stackIndex={idx}
                          onAceitar={handleAceitar}
                          onRejeitar={handleRejeitar}
                          onEditar={() => setEditando(s)}
                          isProcessing={processando}
                        />
                      )}
                    </AnimatePresence>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Botões de ação */}
            <div className="mt-6 flex items-center justify-center gap-4 pb-safe-bottom">
              <motion.button
                type="button"
                onClick={handleRejeitar}
                disabled={processando}
                aria-label="Rejeitar sugestão"
                whileHover={!processando ? { scale: 1.08 } : {}}
                whileTap={!processando ? { scale: 0.93 } : {}}
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full',
                  'border border-danger/40 bg-danger/10 text-danger transition-colors hover:bg-danger/20',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger',
                  processando && 'cursor-not-allowed opacity-40',
                )}
              >
                <X className="h-6 w-6" aria-hidden />
              </motion.button>

              <motion.button
                type="button"
                onClick={() => {
                  const s = sugestoes[0];
                  if (s) setEditando(s);
                }}
                disabled={processando}
                aria-label="Editar sugestão antes de criar"
                whileHover={!processando ? { scale: 1.05 } : {}}
                whileTap={!processando ? { scale: 0.95 } : {}}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full',
                  'border border-border-strong bg-bg-surface text-text-secondary transition-colors hover:text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
                  processando && 'cursor-not-allowed opacity-40',
                )}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </motion.button>

              <motion.button
                type="button"
                onClick={handleAceitar}
                disabled={processando}
                aria-label="Aceitar sugestão e criar tarefa"
                whileHover={!processando ? { scale: 1.08 } : {}}
                whileTap={!processando ? { scale: 0.93 } : {}}
                className={cn(
                  'animate-pulse-jade flex h-14 w-14 items-center justify-center rounded-full',
                  'grad-jade text-text-inverse shadow-lg',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
                  processando && 'cursor-not-allowed opacity-40',
                )}
              >
                <ArrowRight className="h-6 w-6" aria-hidden />
              </motion.button>
            </div>

            {/* Legenda dos botões */}
            <div className="mt-2 flex items-center justify-center gap-8 pb-2">
              <span className="text-xs text-text-muted">Rejeitar</span>
              <span className="text-xs text-text-muted">Editar</span>
              <span className="text-xs text-text-muted">Aceitar</span>
            </div>

            {/* Contador */}
            <p className="pb-4 text-center text-xs text-text-muted">
              Aceitas: {aceitas} &middot; Rejeitadas: {rejeitadas}
            </p>
          </div>
        )}
      </main>

      {/* Modal de edição */}
      <AnimatePresence>
        {editando && (
          <EditModal
            sugestao={editando}
            onConfirmar={handleEditarConfirmar}
            onCancelar={() => setEditando(null)}
          />
        )}
      </AnimatePresence>

      {/* Nav back */}
      <nav className="fixed bottom-4 left-4 pb-safe-bottom" aria-label="Voltar">
        <Link
          href="/configuracoes"
          aria-label="Ir para configurações"
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-text-muted transition-colors hover:text-text-secondary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-accent',
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Config.
        </Link>
      </nav>
    </div>
  );
}
