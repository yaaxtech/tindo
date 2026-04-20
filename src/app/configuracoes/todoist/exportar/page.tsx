'use client';

import { cn } from '@/lib/utils';
import { useToasts } from '@/stores/toasts';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TarefaPrevia {
  id: string;
  titulo: string;
  tipo: 'tarefa' | 'lembrete';
  projetoId: string | null;
  projetoNome: string | null;
  projetoTemTodoistId: boolean;
  dataVencimento: string | null;
  prioridade: number;
}

interface PreviaResponse {
  tarefas: TarefaPrevia[];
  total: number;
}

interface ExportResult {
  tarefasExportadas: number;
  projetosCriados: number;
  erros: Array<{ tarefaId: string; mensagem: string }>;
  duracaoMs: number;
}

type Filtro = 'ambos' | 'tarefa' | 'lembrete';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-bg-hover', className)} />;
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

const PASSOS = ['Seleção', 'Exportando', 'Concluído'];

function Stepper({ passo }: { passo: number }) {
  return (
    <nav aria-label="Etapas" className="mb-8 flex items-center justify-center gap-0">
      {PASSOS.map((label, i) => {
        const num = i + 1;
        const ativa = num === passo;
        const concluida = num < passo;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all',
                  concluida
                    ? 'bg-jade text-text-inverse'
                    : ativa
                      ? 'bg-jade text-text-inverse ring-2 ring-jade/30 ring-offset-2 ring-offset-bg-deep'
                      : 'bg-bg-hover text-text-muted',
                )}
              >
                {concluida ? <Check className="h-4 w-4" /> : num}
              </div>
              <span
                className={cn(
                  'text-[10px]',
                  ativa || concluida ? 'text-jade-accent' : 'text-text-muted',
                )}
              >
                {label}
              </span>
            </div>
            {i < PASSOS.length - 1 && (
              <div
                className={cn(
                  'mb-4 h-px w-12 transition-colors',
                  concluida ? 'bg-jade' : 'bg-bg-hover',
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Passo 1 — Seleção
// ---------------------------------------------------------------------------

function Passo1({
  onProximo,
}: {
  onProximo: (ids: string[], criarProjetos: boolean) => void;
}) {
  const [previa, setPrevia] = useState<PreviaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState<Filtro>('ambos');
  const [criarProjetos, setCriarProjetos] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch('/api/todoist/exportar/previa');
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const body = (await res.json()) as PreviaResponse;
      setPrevia(body);
      setSelecionados(new Set(body.tarefas.map((t) => t.id)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar prévia');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const tarefasFiltradas =
    previa?.tarefas.filter((t) => filtro === 'ambos' || t.tipo === filtro) ?? [];

  const projetosSemTodoist = [
    ...new Map(
      tarefasFiltradas
        .filter((t) => t.projetoId && !t.projetoTemTodoistId && selecionados.has(t.id))
        .map((t) => [t.projetoId!, { id: t.projetoId!, nome: t.projetoNome ?? t.projetoId! }]),
    ).values(),
  ];

  const toggleTarefa = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (selecionados.size === tarefasFiltradas.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(tarefasFiltradas.map((t) => t.id)));
    }
  };

  // Group by project
  const porProjeto = tarefasFiltradas.reduce<Record<string, TarefaPrevia[]>>((acc, t) => {
    const key = t.projetoNome ?? 'Sem projeto Todoist';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-danger/30 bg-danger/5 p-6">
        <AlertTriangle className="h-6 w-6 text-danger" />
        <p className="text-sm text-danger">{erro}</p>
        <button
          type="button"
          onClick={() => void carregar()}
          className="flex items-center gap-2 rounded-xl border border-border-strong bg-bg-elevated px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!previa || previa.total === 0) {
    return (
      <div className="rounded-xl border border-jade/30 bg-jade/5 p-6 text-center">
        <CircleCheck className="mx-auto mb-2 h-8 w-8 text-jade-accent" />
        <p className="text-sm font-semibold text-text-primary">Tudo sincronizado!</p>
        <p className="mt-1 text-xs text-text-muted">Todas as tarefas locais já estão no Todoist.</p>
        <Link
          href="/configuracoes/todoist"
          className="mt-4 block text-xs text-jade-accent hover:underline"
        >
          Voltar ao Todoist
        </Link>
      </div>
    );
  }

  const selecionadosCount = [...selecionados].filter((id) =>
    tarefasFiltradas.some((t) => t.id === id),
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex gap-2">
        {(['ambos', 'tarefa', 'lembrete'] as Filtro[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              filtro === f
                ? 'bg-jade text-text-inverse'
                : 'border border-border-strong bg-bg-elevated text-text-muted hover:bg-bg-hover',
            )}
          >
            {f === 'ambos' ? 'Ambos' : f === 'tarefa' ? 'Só tarefas' : 'Só lembretes'}
          </button>
        ))}
      </div>

      {/* Selecionar todos */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          {selecionadosCount} de {tarefasFiltradas.length} selecionadas
        </p>
        <button
          type="button"
          onClick={toggleTodos}
          className="text-xs text-jade-accent hover:underline"
        >
          {selecionados.size === tarefasFiltradas.length ? 'Desmarcar todos' : 'Selecionar todos'}
        </button>
      </div>

      {/* Lista agrupada por projeto */}
      <div className="max-h-64 overflow-y-auto rounded-xl border border-border-strong bg-bg-deep">
        {Object.entries(porProjeto).map(([proj, tarefas]) => (
          <div key={proj}>
            <p className="border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {proj}
            </p>
            {tarefas.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-bg-hover"
              >
                <input
                  type="checkbox"
                  checked={selecionados.has(t.id)}
                  onChange={() => toggleTarefa(t.id)}
                  className="h-4 w-4 rounded accent-jade"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-text-primary">{t.titulo}</p>
                  <p className="text-[10px] text-text-muted">
                    {t.tipo === 'lembrete' ? 'Lembrete' : 'Tarefa'}
                    {t.dataVencimento ? ` · ${t.dataVencimento}` : ''}
                  </p>
                </div>
              </label>
            ))}
          </div>
        ))}
      </div>

      {/* Projetos sem todoist_id */}
      {projetosSemTodoist.length > 0 && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-strong bg-bg-deep p-3">
          <input
            type="checkbox"
            checked={criarProjetos}
            onChange={(e) => setCriarProjetos(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-jade"
          />
          <div>
            <p className="text-xs font-medium text-text-secondary">
              Criar {projetosSemTodoist.length} projeto{projetosSemTodoist.length !== 1 ? 's' : ''}{' '}
              no Todoist
            </p>
            <p className="mt-0.5 text-[10px] text-text-muted">
              {projetosSemTodoist.map((p) => p.nome).join(', ')}
            </p>
          </div>
        </label>
      )}

      <button
        type="button"
        disabled={selecionadosCount === 0}
        onClick={() =>
          onProximo(
            [...selecionados].filter((id) => tarefasFiltradas.some((t) => t.id === id)),
            criarProjetos,
          )
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-jade px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-jade-accent disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        Exportar {selecionadosCount} tarefa{selecionadosCount !== 1 ? 's' : ''}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Passo 2 — Em progresso
// ---------------------------------------------------------------------------

function Passo2({
  tarefaIds,
  criarProjetos,
  onConcluido,
}: {
  tarefaIds: string[];
  criarProjetos: boolean;
  onConcluido: (r: ExportResult) => void;
}) {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLogs(['Iniciando exportação...']);
      try {
        const res = await fetch('/api/todoist/exportar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tarefaIds, criarProjetosFaltantes: criarProjetos }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          setLogs((prev) => [...prev, `Erro: ${err.error ?? res.status}`]);
          return;
        }
        const body = (await res.json()) as ExportResult;
        if (cancelled) return;
        setLogs((prev) => [...prev, `Concluído — ${body.tarefasExportadas} tarefas exportadas`]);
        onConcluido(body);
      } catch (e) {
        if (!cancelled) {
          setLogs((prev) => [
            ...prev,
            `Erro inesperado: ${e instanceof Error ? e.message : String(e)}`,
          ]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border-strong bg-bg-elevated p-5">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-jade-accent" />
        <p className="text-sm font-semibold text-text-primary">Exportando para o Todoist...</p>
      </div>
      {/* Progress bar indeterminate */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-hover">
        <motion.div
          className="h-full rounded-full bg-jade"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.4, ease: 'easeInOut' }}
          style={{ width: '40%' }}
        />
      </div>
      <div className="max-h-40 overflow-y-auto rounded-lg bg-bg-deep p-3 font-mono text-xs text-text-muted">
        {logs.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Passo 3 — Sucesso
// ---------------------------------------------------------------------------

function Passo3({ resultado }: { resultado: ExportResult }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-jade/30 bg-jade/5 p-5 text-center">
        <CircleCheck className="mx-auto mb-2 h-10 w-10 text-jade-accent" />
        <p className="text-base font-bold text-text-primary">Exportação concluída!</p>
        <p className="mt-1 text-xs text-text-muted">
          {resultado.tarefasExportadas} tarefa{resultado.tarefasExportadas !== 1 ? 's' : ''} enviada
          {resultado.tarefasExportadas !== 1 ? 's' : ''}
          {resultado.projetosCriados > 0
            ? ` · ${resultado.projetosCriados} projeto${resultado.projetosCriados !== 1 ? 's' : ''} criado${resultado.projetosCriados !== 1 ? 's' : ''}`
            : ''}
          {resultado.erros.length > 0
            ? ` · ${resultado.erros.length} erro${resultado.erros.length !== 1 ? 's' : ''}`
            : ''}
        </p>
      </div>

      {resultado.erros.length > 0 && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-danger">
            <XCircle className="h-4 w-4" />
            Erros ({resultado.erros.length})
          </p>
          <div className="space-y-1">
            {resultado.erros.map((e) => (
              <p key={e.tarefaId} className="text-xs text-text-muted">
                <span className="text-danger">{e.tarefaId.slice(0, 8)}</span>: {e.mensagem}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Link
          href="/configuracoes/todoist"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-jade px-4 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-jade-accent"
        >
          <CircleCheck className="h-4 w-4" />
          Voltar ao Todoist
        </Link>
        <Link
          href="/tarefas"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-elevated px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
        >
          Ver tarefas
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export default function ExportarTodoistPage() {
  const [passo, setPasso] = useState(1);
  const [dir, setDir] = useState(1);
  const [tarefaIds, setTarefaIds] = useState<string[]>([]);
  const [criarProjetos, setCriarProjetos] = useState(true);
  const [resultado, setResultado] = useState<ExportResult | null>(null);
  const toast = useToasts((s) => s.push);

  const avancar = (novoPasso: number) => {
    setDir(1);
    setPasso(novoPasso);
  };

  return (
    <div className="min-h-screen bg-bg-deep px-4 py-8">
      <div className="mx-auto max-w-xl">
        <Link
          href="/configuracoes/todoist"
          className="mb-6 flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Todoist
        </Link>

        <h1 className="mb-6 text-center text-xl font-bold text-text-primary">
          Exportar para o Todoist
        </h1>

        <Stepper passo={passo} />

        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={passo}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {passo === 1 && (
                <Passo1
                  onProximo={(ids, criar) => {
                    setTarefaIds(ids);
                    setCriarProjetos(criar);
                    avancar(2);
                  }}
                />
              )}
              {passo === 2 && (
                <Passo2
                  tarefaIds={tarefaIds}
                  criarProjetos={criarProjetos}
                  onConcluido={(r) => {
                    setResultado(r);
                    if (r.tarefasExportadas > 0) {
                      toast({ titulo: `${r.tarefasExportadas} tarefas exportadas`, icone: 'ok' });
                    }
                    avancar(3);
                  }}
                />
              )}
              {passo === 3 && resultado && <Passo3 resultado={resultado} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
