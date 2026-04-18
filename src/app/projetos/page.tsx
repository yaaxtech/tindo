'use client';

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { ArrowLeft, GripVertical, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ProjetoRow {
  id: string;
  todoist_id: string | null;
  nome: string;
  cor: string;
  ordem_prioridade: number;
  multiplicador: number;
  ativo: boolean;
}

const MULT_POR_POSICAO = [1.3, 1.15, 1.0, 0.9, 0.85, 0.8];

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<ProjetoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/projetos');
        const body = (await res.json()) as { projetos: ProjetoRow[] };
        setProjetos(
          body.projetos.map((p) => ({ ...p, multiplicador: Number(p.multiplicador) })),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setProjetos((current) => {
      const oldIdx = current.findIndex((p) => p.id === active.id);
      const newIdx = current.findIndex((p) => p.id === over.id);
      const reordered = arrayMove(current, oldIdx, newIdx).map((p, i) => ({
        ...p,
        ordem_prioridade: i,
        multiplicador: MULT_POR_POSICAO[i] ?? 0.8,
      }));
      return reordered;
    });
  };

  const handleEditarMultiplicador = (id: string, valor: number) => {
    setProjetos((cur) => cur.map((p) => (p.id === id ? { ...p, multiplicador: valor } : p)));
  };

  const salvar = async () => {
    setSalvando(true);
    setMensagem(null);
    try {
      const res = await fetch('/api/projetos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projetos: projetos.map((p) => ({
            id: p.id,
            ordem_prioridade: p.ordem_prioridade,
            multiplicador: p.multiplicador,
          })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMensagem('Projetos salvos. Rode "Recalcular notas" pra aplicar.');
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  };

  const recalcular = async () => {
    setRecalculando(true);
    try {
      const res = await fetch('/api/recalcular-notas', { method: 'POST' });
      const { atualizadas } = (await res.json()) as { atualizadas: number };
      setMensagem(`${atualizadas} tarefas recalculadas.`);
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro');
    } finally {
      setRecalculando(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="h-10 w-10 animate-pulse-jade rounded-full bg-jade" />
      </main>
    );
  }

  return (
    <main className="min-h-dvh pb-24 safe-top safe-bottom">
      <header className="sticky top-0 z-10 border-b border-border bg-bg-deep/80 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4">
          <Link
            href="/cards"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Projetos</h1>
            <p className="text-xs text-text-muted">
              Arraste pra ordenar. Ordem define multiplicador da nota. {projetos.length} projetos.
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto mt-6 w-full max-w-3xl px-6">
        <div className="mb-4 rounded-md border border-jade-accent/40 bg-jade-dim/20 p-4 text-sm">
          <p className="text-text-primary">
            <strong className="text-jade-accent">Lembre-se</strong>: a prioridade aqui é pra projetos que MAIS
            te despreocupariam. O multiplicador escala a nota de todas as tarefas desse projeto.
          </p>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={projetos.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {projetos.map((p, i) => (
                <ProjetoItem
                  key={p.id}
                  projeto={p}
                  posicao={i + 1}
                  onEditMultiplicador={handleEditarMultiplicador}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </section>

      {/* Footer ações */}
      <footer className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-bg-deep/95 backdrop-blur-xl px-6 py-3 safe-bottom">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-text-secondary">
            {mensagem ?? 'Faça as mudanças, salve, depois recalcule as notas.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="inline-flex h-10 items-center justify-center rounded-md border border-border-strong bg-bg-elevated px-4 text-sm font-medium text-text-primary hover:bg-bg-hover disabled:opacity-40"
            >
              {salvando ? 'Salvando...' : 'Salvar ordem'}
            </button>
            <button
              type="button"
              onClick={recalcular}
              disabled={recalculando}
              className="inline-flex h-10 items-center gap-2 rounded-md grad-jade px-4 text-sm font-medium text-text-inverse disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', recalculando && 'animate-spin')} />
              {recalculando ? 'Recalculando...' : 'Recalcular notas'}
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ProjetoItem({
  projeto,
  posicao,
  onEditMultiplicador,
}: {
  projeto: ProjetoRow;
  posicao: number;
  onEditMultiplicador: (id: string, valor: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: projeto.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border-strong bg-bg-elevated p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-text-muted touch-none hover:text-text-primary active:cursor-grabbing"
        aria-label="Arrastar"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <span className="w-8 text-center font-mono text-xs text-text-muted">{posicao}</span>
      <span
        className="h-7 w-7 shrink-0 rounded-full"
        style={{ background: projeto.cor }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{projeto.nome}</p>
        {projeto.todoist_id && (
          <p className="text-[10px] text-text-muted">Sincronizado do Todoist</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[11px] uppercase tracking-wider text-text-muted" htmlFor={`mult-${projeto.id}`}>
          ×
        </label>
        <input
          id={`mult-${projeto.id}`}
          type="number"
          step={0.05}
          min={0}
          max={5}
          value={projeto.multiplicador}
          onChange={(e) => onEditMultiplicador(projeto.id, Number(e.target.value))}
          className="h-9 w-20 rounded-md border border-border-strong bg-bg-surface px-2 text-right text-sm font-semibold text-text-primary outline-none focus:border-jade-accent"
        />
      </div>
    </li>
  );
}
