'use client';

import { cn } from '@/lib/utils';
import { useToasts } from '@/stores/toasts';
import type { Tarefa } from '@/types/domain';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ProjetoLite {
  id: string;
  nome: string;
  cor: string;
}
interface TagLite {
  id: string;
  nome: string;
  cor: string;
}

export interface TarefaModalProps {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (payload: SalvarPayload) => Promise<void>;
  modo: 'editar' | 'criar';
  tarefa?: Tarefa;
  projetos: ProjetoLite[];
  tags: TagLite[];
}

export interface SalvarPayload {
  titulo: string;
  descricao: string | null;
  tipo: 'tarefa' | 'lembrete';
  projeto_id: string | null;
  prioridade: 1 | 2 | 3 | 4;
  data_vencimento: string | null;
  prazo_conclusao: string | null;
  importancia: number | null;
  urgencia: number | null;
  facilidade: number | null;
  tag_ids: string[];
}

export function TarefaModal({
  aberto,
  onFechar,
  onSalvar,
  modo,
  tarefa,
  projetos,
  tags,
}: TarefaModalProps) {
  const [form, setForm] = useState<SalvarPayload>(() => mkInicial(tarefa));
  const [salvando, setSalvando] = useState(false);
  const [classificando, setClassificando] = useState(false);
  const [explicacaoIA, setExplicacaoIA] = useState<string | null>(null);
  const pushToast = useToasts((s) => s.push);
  const classificarInicioRef = useRef<number>(0);

  useEffect(() => {
    if (aberto) {
      setForm(mkInicial(tarefa));
      setExplicacaoIA(null);
    }
  }, [aberto, tarefa]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    if (aberto) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [aberto, onFechar]);

  const patch = <K extends keyof SalvarPayload>(campo: K, valor: SalvarPayload[K]) => {
    setForm((f) => ({ ...f, [campo]: valor }));
  };

  const toggleTag = (id: string) => {
    setForm((f) => ({
      ...f,
      tag_ids: f.tag_ids.includes(id) ? f.tag_ids.filter((t) => t !== id) : [...f.tag_ids, id],
    }));
  };

  const classificarComIA = async () => {
    setClassificando(true);
    setExplicacaoIA(null);
    classificarInicioRef.current = Date.now();

    try {
      const body =
        modo === 'editar' && tarefa?.id
          ? { tarefaId: tarefa.id }
          : { titulo: form.titulo, descricao: form.descricao ?? undefined, projetoId: form.projeto_id ?? undefined };

      const res = await fetch('/api/ai/classificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        // Narrow to error shape
        const err = data as { error?: string };
        const msg = err?.error ?? 'Erro ao classificar';
        if (msg.toLowerCase().includes('configure') || msg.toLowerCase().includes('chave')) {
          pushToast({
            titulo: 'Chave de IA não configurada',
            descricao: msg,
            icone: 'alerta',
            acao: {
              label: 'Configurar',
              onClick: () => { window.open('/configuracoes', '_blank'); },
            },
          });
        } else {
          pushToast({ titulo: 'Erro ao classificar', descricao: msg, icone: 'alerta' });
        }
        return;
      }

      const { classificacao } = data as {
        classificacao: {
          importancia: number;
          urgencia: number;
          facilidade: number;
          tags_sugeridas: string[];
          explicacao: string;
        };
        usage: unknown;
      };

      // Apply suggestions to form
      setForm((f) => {
        const tagsDeduped = Array.from(new Set([...f.tag_ids, ...classificacao.tags_sugeridas]));
        return {
          ...f,
          importancia: classificacao.importancia,
          urgencia: classificacao.urgencia,
          facilidade: classificacao.facilidade,
          tag_ids: tagsDeduped,
        };
      });
      setExplicacaoIA(classificacao.explicacao);

      const elapsed = ((Date.now() - classificarInicioRef.current) / 1000).toFixed(1);
      pushToast({
        titulo: `IA classificou em ${elapsed}s`,
        descricao: classificacao.explicacao,
        icone: 'ok',
      });
    } catch {
      pushToast({ titulo: 'Erro inesperado ao classificar', icone: 'alerta' });
    } finally {
      setClassificando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await onSalvar(form);
      onFechar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onFechar}
        >
          <motion.div
            className="max-h-[90dvh] w-full max-w-lg overflow-hidden rounded-xl border border-border-strong bg-bg-elevated shadow-elevated"
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">
                {modo === 'editar' ? 'Editar tarefa' : 'Nova tarefa'}
              </h2>
              <button
                type="button"
                onClick={onFechar}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-hover hover:text-text-primary"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <form
              onSubmit={handleSubmit}
              className="max-h-[calc(90dvh-100px)] overflow-y-auto px-5 py-4 text-sm"
            >
              <div className="space-y-4">
                <Campo label="Título *">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={form.titulo}
                    onChange={(e) => patch('titulo', e.target.value)}
                    className="h-10 w-full rounded-md border border-border-strong bg-bg-surface px-3 outline-none focus:border-jade-accent"
                  />
                </Campo>

                <Campo label="Descrição">
                  <textarea
                    rows={2}
                    value={form.descricao ?? ''}
                    onChange={(e) => patch('descricao', e.target.value || null)}
                    className="w-full rounded-md border border-border-strong bg-bg-surface px-3 py-2 outline-none focus:border-jade-accent"
                  />
                </Campo>

                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Tipo">
                    <select
                      value={form.tipo}
                      onChange={(e) => patch('tipo', e.target.value as 'tarefa' | 'lembrete')}
                      className="h-10 w-full rounded-md border border-border-strong bg-bg-surface px-3 outline-none focus:border-jade-accent"
                    >
                      <option value="tarefa">Tarefa</option>
                      <option value="lembrete">Lembrete</option>
                    </select>
                  </Campo>
                  <Campo label="Prioridade">
                    <select
                      value={form.prioridade}
                      onChange={(e) => patch('prioridade', Number(e.target.value) as 1 | 2 | 3 | 4)}
                      className="h-10 w-full rounded-md border border-border-strong bg-bg-surface px-3 outline-none focus:border-jade-accent"
                    >
                      <option value={1}>P1 — afeta o sono</option>
                      <option value={2}>P2 — afeta a rotina</option>
                      <option value={3}>P3 — bom ROI</option>
                      <option value={4}>P4 — padrão</option>
                    </select>
                  </Campo>
                </div>

                <Campo label="Projeto">
                  <select
                    value={form.projeto_id ?? ''}
                    onChange={(e) => patch('projeto_id', e.target.value || null)}
                    className="h-10 w-full rounded-md border border-border-strong bg-bg-surface px-3 outline-none focus:border-jade-accent"
                  >
                    <option value="">— nenhum —</option>
                    {projetos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </Campo>

                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Data">
                    <input
                      type="date"
                      value={form.data_vencimento ?? ''}
                      onChange={(e) => patch('data_vencimento', e.target.value || null)}
                      className="h-10 w-full rounded-md border border-border-strong bg-bg-surface px-3 outline-none focus:border-jade-accent"
                    />
                  </Campo>
                  <Campo label="Prazo (hard)">
                    <input
                      type="date"
                      value={form.prazo_conclusao ?? ''}
                      onChange={(e) => patch('prazo_conclusao', e.target.value || null)}
                      className="h-10 w-full rounded-md border border-border-strong bg-bg-surface px-3 outline-none focus:border-jade-accent"
                    />
                  </Campo>
                </div>

                {/* Seção IA */}
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={classificando || form.titulo.trim().length < 3}
                    aria-busy={classificando}
                    aria-label="Classificar importância, urgência e facilidade com IA"
                    onClick={classificarComIA}
                    className={cn(
                      'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors',
                      'border-jade-accent/50 bg-jade-dim/20 text-jade-accent hover:bg-jade-dim/40',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                    )}
                  >
                    <Sparkles className={cn('h-3.5 w-3.5', classificando && 'animate-pulse')} />
                    {classificando ? 'Classificando…' : 'Classificar com IA'}
                  </button>

                  <AnimatePresence>
                    {explicacaoIA && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-start gap-2 rounded-md border border-jade-accent/30 bg-jade-dim/15 px-3 py-2"
                      >
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-jade-accent" />
                        <p className="text-[11px] leading-snug text-text-secondary">{explicacaoIA}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Campo label="Overrides manuais (opcional — deixe em branco pro automático)">
                  <div className="space-y-3">
                    <Slider
                      label="Importância"
                      valor={form.importancia}
                      onChange={(v) => patch('importancia', v)}
                    />
                    <Slider
                      label="Urgência"
                      valor={form.urgencia}
                      onChange={(v) => patch('urgencia', v)}
                    />
                    <Slider
                      label="Facilidade"
                      valor={form.facilidade}
                      onChange={(v) => patch('facilidade', v)}
                    />
                  </div>
                </Campo>

                <Campo label="Tags">
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTag(t.id)}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                          form.tag_ids.includes(t.id)
                            ? 'border-jade-accent bg-jade-dim text-jade-accent'
                            : 'border-border-strong bg-bg-surface text-text-secondary hover:border-border-strong',
                        )}
                        style={
                          form.tag_ids.includes(t.id)
                            ? undefined
                            : { color: t.cor, borderColor: `${t.cor}55` }
                        }
                      >
                        {t.nome}
                      </button>
                    ))}
                    {tags.length === 0 && (
                      <span className="text-xs text-text-muted">Nenhuma tag disponível.</span>
                    )}
                  </div>
                </Campo>
              </div>

              <footer className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-[11px] text-text-muted">
                  ⚠️ Push Todoist desabilitado — mudanças ficam só no TinDo.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onFechar}
                    className="h-10 rounded-md border border-border-strong bg-bg-surface px-4 text-sm text-text-primary hover:bg-bg-hover"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvando || !form.titulo.trim()}
                    className="h-10 rounded-md grad-jade px-5 text-sm font-semibold text-text-inverse disabled:opacity-40"
                  >
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </footer>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function Slider({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: number | null;
  onChange: (v: number | null) => void;
}) {
  const ativo = valor !== null;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-text-muted">{ativo ? valor : 'auto'}</span>
          {ativo && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[10px] text-text-muted hover:text-text-primary"
            >
              limpar
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={valor ?? 50}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn('w-full', ativo ? 'accent-jade-accent' : 'accent-text-muted')}
      />
    </div>
  );
}

function mkInicial(t?: Tarefa): SalvarPayload {
  if (!t) {
    return {
      titulo: '',
      descricao: null,
      tipo: 'tarefa',
      projeto_id: null,
      prioridade: 4,
      data_vencimento: null,
      prazo_conclusao: null,
      importancia: null,
      urgencia: null,
      facilidade: null,
      tag_ids: [],
    };
  }
  return {
    titulo: t.titulo,
    descricao: t.descricao ?? null,
    tipo: t.tipo,
    projeto_id: t.projetoId ?? null,
    prioridade: t.prioridade,
    data_vencimento: t.dataVencimento ?? null,
    prazo_conclusao: t.prazoConclusao ?? null,
    importancia: t.importancia ?? null,
    urgencia: t.urgencia ?? null,
    facilidade: t.facilidade ?? null,
    tag_ids: t.tags.map((tag) => tag.id),
  };
}
