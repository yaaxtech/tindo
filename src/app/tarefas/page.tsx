'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCardStackStore } from '@/stores/cardStack';
import { BotaoSync } from '@/components/BotaoSync';
import { mockTarefas } from '@/lib/mock/tarefas';
import type { Tarefa } from '@/types/domain';
import { corUrgencia } from '@/lib/urgency-color';
import { cn, formatRelativeDate } from '@/lib/utils';

type OrdemLista =
  | 'nota_desc'
  | 'nota_asc'
  | 'data_asc'
  | 'data_desc'
  | 'alfabetica'
  | 'criada_recente';

const ORDENS: { value: OrdemLista; label: string }[] = [
  { value: 'nota_desc', label: 'Nota (maior → menor)' },
  { value: 'nota_asc', label: 'Nota (menor → maior)' },
  { value: 'data_asc', label: 'Data (próximas primeiro)' },
  { value: 'data_desc', label: 'Data (distantes primeiro)' },
  { value: 'alfabetica', label: 'Alfabética' },
  { value: 'criada_recente', label: 'Criada recentemente' },
];

export default function TarefasPage() {
  const { fila } = useCardStackStore();
  const [ordem, setOrdem] = useState<OrdemLista>('nota_desc');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'tarefa' | 'lembrete'>('todos');
  const [busca, setBusca] = useState('');

  const [filaReal, setFilaReal] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch('/api/fila', { cache: 'no-store' });
        const body = (await res.json()) as { fila: Tarefa[] };
        if (!cancelado) setFilaReal(body.fila);
      } catch {
        /* usa fallback */
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const fonte: Tarefa[] = filaReal.length > 0 ? filaReal : fila.length > 0 ? fila : mockTarefas;

  const tarefas = useMemo(() => {
    let filtradas = fonte.filter((t) => t.status === 'pendente');
    if (filtroTipo !== 'todos') filtradas = filtradas.filter((t) => t.tipo === filtroTipo);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      filtradas = filtradas.filter(
        (t) =>
          t.titulo.toLowerCase().includes(q) ||
          t.descricao?.toLowerCase().includes(q) ||
          t.projeto?.nome.toLowerCase().includes(q),
      );
    }
    return ordenar(filtradas, ordem);
  }, [fonte, filtroTipo, busca, ordem]);

  const totais = useMemo(() => {
    const pend = fonte.filter((t) => t.status === 'pendente');
    return {
      total: pend.length,
      tarefas: pend.filter((t) => t.tipo === 'tarefa').length,
      lembretes: pend.filter((t) => t.tipo === 'lembrete').length,
      mediaNota: Math.round(pend.reduce((s, t) => s + t.nota, 0) / Math.max(1, pend.length)),
    };
  }, [fonte]);

  return (
    <main className="min-h-dvh pb-16 safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-bg-deep/80 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-4">
          <Link
            href="/cards"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-bg-elevated text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            aria-label="Voltar aos cards"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Todas as tarefas</h1>
            <p className="text-xs text-text-muted">
              {totais.total} pendentes · {totais.tarefas} tarefas · {totais.lembretes} lembretes · média nota {totais.mediaNota}
            </p>
          </div>
          <nav className="flex items-center gap-2 text-xs">
            <Link
              href="/projetos"
              className="rounded-full border border-border-strong bg-bg-elevated px-3 py-1.5 font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Projetos
            </Link>
            <Link
              href="/tags"
              className="rounded-full border border-border-strong bg-bg-elevated px-3 py-1.5 font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Tags
            </Link>
            <Link
              href="/configuracoes"
              className="rounded-full border border-border-strong bg-bg-elevated px-3 py-1.5 font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Config
            </Link>
            <Link
              href="/gamificacao"
              className="rounded-full border border-border-strong bg-bg-elevated px-3 py-1.5 font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Stats
            </Link>
            <BotaoSync />
          </nav>
        </div>
      </header>

      {/* Controles */}
      <section className="mx-auto w-full max-w-4xl px-6 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar título, descrição ou projeto..."
            className="h-10 min-w-[220px] flex-1 rounded-md border border-border-strong bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-jade-accent"
          />
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as OrdemLista)}
            className="h-10 rounded-md border border-border-strong bg-bg-elevated px-3 text-sm text-text-primary outline-none focus:border-jade-accent"
          >
            {ORDENS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="inline-flex overflow-hidden rounded-md border border-border-strong">
            {(['todos', 'tarefa', 'lembrete'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFiltroTipo(t)}
                className={cn(
                  'h-10 px-4 text-sm transition-colors',
                  filtroTipo === t
                    ? 'grad-jade text-text-inverse'
                    : 'bg-bg-elevated text-text-secondary hover:bg-bg-hover',
                )}
              >
                {t === 'todos' ? 'Todos' : t === 'tarefa' ? 'Tarefas' : 'Lembretes'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Lista */}
      <section className="mx-auto mt-6 w-full max-w-4xl px-6">
        {tarefas.length === 0 ? (
          <div className="rounded-xl border border-border bg-bg-elevated p-12 text-center text-sm text-text-muted">
            Nada por aqui com esse filtro.
          </div>
        ) : (
          <ul className="space-y-2">
            {tarefas.map((t) => (
              <TarefaRow key={t.id} tarefa={t} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function TarefaRow({ tarefa }: { tarefa: Tarefa }) {
  const urg = corUrgencia(tarefa.nota);
  const corProjeto = tarefa.projeto?.cor ?? '#2CAF93';
  return (
    <li
      className="group relative overflow-hidden rounded-lg border bg-bg-elevated p-4 transition-colors hover:bg-bg-hover"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      {/* Barra lateral de urgência */}
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: urg.borderColor }}
        aria-hidden
      />
      <div className="ml-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            {tarefa.projeto && (
              <span className="font-medium" style={{ color: corProjeto }}>
                {tarefa.projeto.nome}
              </span>
            )}
            {tarefa.tipo === 'lembrete' && (
              <span className="rounded bg-jade-dim/40 px-1.5 py-0.5 text-jade-accent">lembrete</span>
            )}
            {tarefa.tags.slice(0, 4).map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border px-1.5 py-0.5 text-[10px]"
                style={{ borderColor: `${tag.cor}55`, color: tag.cor }}
              >
                {tag.nome}
              </span>
            ))}
          </div>
          <p className="truncate text-sm font-medium text-text-primary">{tarefa.titulo}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {formatRelativeDate(tarefa.dataVencimento)}
            {tarefa.prazoConclusao && ` · prazo ${formatRelativeDate(tarefa.prazoConclusao)}`}
            {tarefa.adiadaAte && ` · adiada`}
          </p>
        </div>
        <div
          className="flex h-12 w-14 flex-col items-center justify-center rounded-md border"
          style={{
            borderColor: urg.borderColor,
            background: `hsla(${urg.hue}, 70%, 20%, ${0.25 + urg.intensity * 0.35})`,
          }}
        >
          <span className="text-[9px] uppercase tracking-wider text-text-muted">nota</span>
          <span className="text-lg font-bold" style={{ color: urg.borderColor }}>
            {tarefa.nota}
          </span>
        </div>
      </div>
    </li>
  );
}

function ordenar(tarefas: Tarefa[], ordem: OrdemLista): Tarefa[] {
  const arr = [...tarefas];
  switch (ordem) {
    case 'nota_desc':
      return arr.sort((a, b) => b.nota - a.nota);
    case 'nota_asc':
      return arr.sort((a, b) => a.nota - b.nota);
    case 'data_asc':
      return arr.sort((a, b) => cmpData(a.dataVencimento, b.dataVencimento));
    case 'data_desc':
      return arr.sort((a, b) => cmpData(b.dataVencimento, a.dataVencimento));
    case 'alfabetica':
      return arr.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
    case 'criada_recente':
      return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

function cmpData(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}
