'use client';

import { cn } from '@/lib/utils';
import { useToasts } from '@/stores/toasts';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, CheckSquare, RefreshCw, Scissors, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SugestaoItem {
  id: string;
  tipo: 'classificar' | 'quebrar' | string;
  tarefaId: string | null;
  tarefaTitulo: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: payload is dynamic JSON from AI
  payload: any;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resumoClassificar(payload: SugestaoItem['payload']): string {
  if (!payload) return '';
  const partes: string[] = [];
  if (payload.importancia != null) partes.push(`I:${payload.importancia}`);
  if (payload.urgencia != null) partes.push(`U:${payload.urgencia}`);
  if (payload.facilidade != null) partes.push(`F:${payload.facilidade}`);
  const tags = Array.isArray(payload.tags_sugeridas) ? payload.tags_sugeridas.length : 0;
  if (tags > 0) partes.push(`${tags} tag${tags > 1 ? 's' : ''}`);
  return partes.join(' · ');
}

function resumoQuebrar(payload: SugestaoItem['payload']): string {
  if (!payload) return '';
  const sub = Array.isArray(payload.subTarefas) ? payload.subTarefas.length : 0;
  if (!payload.deveQuebrar) return 'IA recomenda manter como uma tarefa';
  return `${sub} sub-tarefa${sub !== 1 ? 's' : ''} sugerida${sub !== 1 ? 's' : ''}`;
}

function explicacao(payload: SugestaoItem['payload']): string {
  if (!payload) return '';
  return String(payload.explicacao ?? '').slice(0, 140);
}

// ---------------------------------------------------------------------------
// EditarClassificacaoPopover
// ---------------------------------------------------------------------------

interface EditarProps {
  sugestao: SugestaoItem;
  onAceitar: (id: string, editada?: Record<string, unknown>) => Promise<void>;
  onFechar: () => void;
}

function EditarClassificacaoPopover({ sugestao, onAceitar, onFechar }: EditarProps) {
  const p = sugestao.payload ?? {};
  const [importancia, setImportancia] = useState<number>(Number(p.importancia ?? 50));
  const [urgencia, setUrgencia] = useState<number>(Number(p.urgencia ?? 50));
  const [facilidade, setFacilidade] = useState<number>(Number(p.facilidade ?? 50));
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await onAceitar(sugestao.id, {
        ...p,
        importancia,
        urgencia,
        facilidade,
      });
      onFechar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="mt-3 rounded-xl border border-jade-accent/40 bg-bg-deep p-4 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-medium text-text-secondary">Editar antes de aceitar</p>
      {(
        [
          { label: 'Importancia', valor: importancia, set: setImportancia },
          { label: 'Urgencia', valor: urgencia, set: setUrgencia },
          { label: 'Facilidade', valor: facilidade, set: setFacilidade },
        ] as const
      ).map(({ label, valor, set }) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-text-secondary">{label}</span>
            <span className="font-mono text-jade-accent">{valor}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={valor}
            onChange={(e) => set(Number(e.target.value))}
            className="w-full accent-jade-accent"
          />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onFechar}
          className="h-8 rounded-md border border-border-strong bg-bg-surface px-3 text-xs text-text-secondary hover:bg-bg-hover"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSalvar}
          disabled={salvando}
          className="h-8 rounded-md grad-jade px-4 text-xs font-semibold text-text-inverse disabled:opacity-40"
        >
          {salvando ? 'Salvando...' : 'Aceitar editado'}
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SugestaoCard
// ---------------------------------------------------------------------------

interface CardProps {
  sugestao: SugestaoItem;
  selecionado: boolean;
  onToggleSelecao: (id: string) => void;
  onAceitar: (id: string, editada?: Record<string, unknown>) => Promise<void>;
  onRejeitar: (id: string) => Promise<void>;
}

function SugestaoCard({
  sugestao,
  selecionado,
  onToggleSelecao,
  onAceitar,
  onRejeitar,
}: CardProps) {
  const [editando, setEditando] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const [rejeitando, setRejeitando] = useState(false);

  const isClassificar = sugestao.tipo === 'classificar';
  const isQuebrar = sugestao.tipo === 'quebrar';

  const handleAceitar = async () => {
    setAceitando(true);
    try {
      await onAceitar(sugestao.id);
    } finally {
      setAceitando(false);
    }
  };

  const handleRejeitar = async () => {
    setRejeitando(true);
    try {
      await onRejeitar(sugestao.id);
    } finally {
      setRejeitando(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.22 }}
      className={cn(
        'rounded-xl border bg-bg-elevated p-4 transition-colors',
        selecionado ? 'border-jade-accent/60 bg-jade-dim/10' : 'border-border-strong',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox de seleção */}
        <button
          type="button"
          onClick={() => onToggleSelecao(sugestao.id)}
          className="mt-0.5 shrink-0 text-text-muted hover:text-jade-accent"
          aria-label={selecionado ? 'Desmarcar' : 'Selecionar'}
        >
          <CheckSquare
            className={cn('h-4 w-4', selecionado ? 'text-jade-accent' : 'text-text-muted')}
          />
        </button>

        {/* Ícone de tipo */}
        <div
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            isClassificar ? 'bg-jade-dim/30 text-jade-accent' : 'bg-amber-500/15 text-amber-400',
          )}
        >
          {isClassificar ? (
            <Sparkles className="h-3.5 w-3.5" />
          ) : (
            <Scissors className="h-3.5 w-3.5" />
          )}
        </div>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">
            {sugestao.tarefaTitulo ?? 'Tarefa sem título'}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {isClassificar ? resumoClassificar(sugestao.payload) : resumoQuebrar(sugestao.payload)}
          </p>
          {explicacao(sugestao.payload) && (
            <p className="mt-1 text-[11px] leading-snug text-text-muted">
              {explicacao(sugestao.payload)}
            </p>
          )}
        </div>
      </div>

      {/* Botões de ação */}
      <div className="mt-3 flex items-center gap-2 pl-10">
        <button
          type="button"
          onClick={handleAceitar}
          disabled={aceitando || rejeitando}
          className="inline-flex h-7 items-center gap-1.5 rounded-md grad-jade px-3 text-xs font-semibold text-text-inverse disabled:opacity-40"
        >
          <Check className="h-3 w-3" />
          {aceitando ? 'Aceitando...' : 'Aceitar'}
        </button>

        {isClassificar && (
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="inline-flex h-7 items-center rounded-md border border-border-strong bg-bg-surface px-3 text-xs text-text-secondary hover:bg-bg-hover"
          >
            Editar
          </button>
        )}

        <button
          type="button"
          onClick={handleRejeitar}
          disabled={aceitando || rejeitando}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-3 text-xs text-danger hover:bg-danger/20 disabled:opacity-40"
        >
          <X className="h-3 w-3" />
          {rejeitando ? 'Rejeitando...' : 'Rejeitar'}
        </button>
      </div>

      {/* Popover de edição */}
      <AnimatePresence>
        {editando && (
          <EditarClassificacaoPopover
            sugestao={sugestao}
            onAceitar={async (id, editada) => {
              await onAceitar(id, editada);
            }}
            onFechar={() => setEditando(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type FiltroTipo = 'todos' | 'classificar' | 'quebrar';

export default function SugestoesIaPage() {
  const [sugestoes, setSugestoes] = useState<SugestaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [aceitandoLote, setAceitandoLote] = useState(false);
  const pushToast = useToasts((s) => s.push);

  const carregarSugestoes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sugestoes-ai');
      const body = (await res.json()) as { sugestoes: SugestaoItem[] };
      setSugestoes(body.sugestoes ?? []);
    } catch {
      pushToast({ titulo: 'Erro ao carregar sugestoes', icone: 'alerta' });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void carregarSugestoes();
  }, [carregarSugestoes]);

  const filtradas = useMemo(() => {
    return sugestoes.filter((s) => {
      if (filtroTipo !== 'todos' && s.tipo !== filtroTipo) return false;
      if (busca) {
        const titulo = (s.tarefaTitulo ?? '').toLowerCase();
        if (!titulo.includes(busca.toLowerCase())) return false;
      }
      return true;
    });
  }, [sugestoes, filtroTipo, busca]);

  const analisarBatch = async () => {
    setAnalisando(true);
    try {
      const res = await fetch('/api/ai/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as { processadas: number; error?: string };
      if (!res.ok) {
        pushToast({ titulo: body.error ?? 'Erro ao analisar', icone: 'alerta' });
        return;
      }
      pushToast({
        titulo: `${body.processadas} tarefa(s) analisada(s)`,
        descricao: 'Sugestoes adicionadas ao inbox',
        icone: 'ok',
      });
      await carregarSugestoes();
    } catch {
      pushToast({ titulo: 'Erro ao analisar tarefas', icone: 'alerta' });
    } finally {
      setAnalisando(false);
    }
  };

  const aceitar = async (id: string, editada?: Record<string, unknown>) => {
    const res = await fetch(`/api/sugestoes-ai/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'aceitar', editada }),
    });
    if (res.ok) {
      setSugestoes((prev) => prev.filter((s) => s.id !== id));
      setSelecionados((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      pushToast({ titulo: 'Sugestao aceita', icone: 'ok' });
    } else {
      pushToast({ titulo: 'Erro ao aceitar sugestao', icone: 'alerta' });
    }
  };

  const rejeitar = async (id: string) => {
    const res = await fetch(`/api/sugestoes-ai/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'rejeitar' }),
    });
    if (res.ok) {
      setSugestoes((prev) => prev.filter((s) => s.id !== id));
      setSelecionados((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      pushToast({ titulo: 'Sugestao rejeitada', icone: 'info' });
    } else {
      pushToast({ titulo: 'Erro ao rejeitar sugestao', icone: 'alerta' });
    }
  };

  const aceitarSelecionadas = async () => {
    if (selecionados.size === 0) return;
    setAceitandoLote(true);
    try {
      const ids = Array.from(selecionados);
      let ok = 0;
      for (const id of ids) {
        const res = await fetch(`/api/sugestoes-ai/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'aceitar' }),
        });
        if (res.ok) {
          ok++;
          setSugestoes((prev) => prev.filter((s) => s.id !== id));
        }
      }
      setSelecionados(new Set());
      pushToast({ titulo: `${ok} sugestao(oes) aceita(s)`, icone: 'ok' });
    } finally {
      setAceitandoLote(false);
    }
  };

  const toggleSelecao = (id: string) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <main className="min-h-dvh pb-24 safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-bg-deep/80 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-4">
          <Link
            href="/cards"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Sugestoes da IA</h1>
            <p className="text-xs text-text-muted">
              {filtradas.length} sugestao{filtradas.length !== 1 ? 'es' : ''} pendente
              {filtradas.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={analisarBatch}
            disabled={analisando}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-jade-accent/50 bg-jade-dim/20 px-3 text-xs font-semibold text-jade-accent hover:bg-jade-dim/40 disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', analisando && 'animate-spin')} />
            {analisando ? 'Analisando...' : 'Analisar sem classificacao'}
          </button>
        </div>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl space-y-4 px-6">
        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {(['todos', 'classificar', 'quebrar'] as FiltroTipo[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFiltroTipo(t)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                filtroTipo === t
                  ? 'border-jade-accent bg-jade-dim/30 text-jade-accent'
                  : 'border-border-strong bg-bg-surface text-text-secondary hover:bg-bg-hover',
              )}
            >
              {t === 'todos' ? 'Todos' : t === 'classificar' ? 'Classificar' : 'Quebrar'}
            </button>
          ))}
          <input
            type="search"
            placeholder="Buscar por titulo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="ml-auto h-8 rounded-md border border-border-strong bg-bg-surface px-3 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-jade-accent"
          />
        </div>

        {/* Acao em lote */}
        <AnimatePresence>
          {selecionados.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center justify-between rounded-lg border border-jade-accent/30 bg-jade-dim/15 px-4 py-3"
            >
              <span className="text-xs text-text-secondary">
                {selecionados.size} selecionada{selecionados.size !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={aceitarSelecionadas}
                disabled={aceitandoLote}
                className="inline-flex h-8 items-center gap-1.5 rounded-md grad-jade px-3 text-xs font-semibold text-text-inverse disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
                {aceitandoLote ? 'Aceitando...' : 'Aceitar todas selecionadas'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-pulse-jade rounded-full bg-jade" />
          </div>
        ) : filtradas.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 py-16 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-elevated border border-border-strong">
              <Sparkles className="h-6 w-6 text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text-secondary">Nenhuma sugestao pendente.</p>
            <p className="max-w-xs text-xs text-text-muted">
              Rode analise em{' '}
              <Link
                href="/configuracoes"
                className="text-jade-accent underline-offset-2 hover:underline"
              >
                /configuracoes
              </Link>{' '}
              ou clique em "Analisar" acima.
            </p>
          </motion.div>
        ) : (
          <motion.div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filtradas.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                  exit={{ opacity: 0, x: -24 }}
                >
                  <SugestaoCard
                    sugestao={s}
                    selecionado={selecionados.has(s.id)}
                    onToggleSelecao={toggleSelecao}
                    onAceitar={aceitar}
                    onRejeitar={rejeitar}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
    </main>
  );
}
