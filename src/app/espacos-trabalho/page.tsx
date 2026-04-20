'use client';

import { cn } from '@/lib/utils';
import { useToasts } from '@/stores/toasts';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import { ArrowLeft, Briefcase, ChevronRight, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface EspacoRow {
  id: string;
  todoist_id: string | null;
  nome: string;
  ordem_prioridade: number;
  ativo: boolean;
}

export default function EspacosTrabalhoPage() {
  const [espacos, setEspacos] = useState<EspacoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const toast = useToasts((s) => s.push);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/espacos-trabalho');
        const body = (await res.json()) as { espacos: EspacoRow[] };
        setEspacos(body.espacos ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    let reordered: EspacoRow[] = [];
    setEspacos((current) => {
      const oldIdx = current.findIndex((e) => e.id === active.id);
      const newIdx = current.findIndex((e) => e.id === over.id);
      reordered = arrayMove(current, oldIdx, newIdx).map((e, i) => ({
        ...e,
        ordem_prioridade: i,
      }));
      return reordered;
    });
    void salvar(reordered);
  };

  const salvar = async (lista: EspacoRow[]) => {
    if (lista.length === 0) return;
    setSalvando(true);
    try {
      const res = await fetch('/api/espacos-trabalho', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          espacos: lista.map((e) => ({ id: e.id, ordem_prioridade: e.ordem_prioridade })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ titulo: 'Ordem atualizada', icone: 'ok', duracaoMs: 3000 });
    } catch (err) {
      toast({
        titulo: 'Erro ao salvar ordem',
        descricao: err instanceof Error ? err.message : 'Tente novamente',
        icone: 'alerta',
      });
    } finally {
      setSalvando(false);
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
            <h1 className="text-lg font-semibold">Espaços de Trabalho</h1>
            <p className="text-xs text-text-muted">
              Arraste pra ordenar. {espacos.length} espaço{espacos.length !== 1 ? 's' : ''}.
            </p>
          </div>
          {salvando && (
            <span className="text-xs text-text-muted animate-pulse">Salvando...</span>
          )}
        </div>
      </header>

      <section className="mx-auto mt-6 w-full max-w-3xl px-6">
        <div className="mb-4 rounded-md border border-jade-accent/40 bg-jade-dim/20 p-4 text-sm">
          <p className="text-text-primary">
            <strong className="text-jade-accent">Lembre-se</strong>: ordene os espaços de trabalho
            por prioridade. As tarefas de espaços no topo ganham mais destaque na fila.
          </p>
        </div>

        {espacos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Briefcase className="h-10 w-10 text-text-muted" />
            <p className="text-text-secondary">Nenhum espaço de trabalho encontrado.</p>
            <p className="text-xs text-text-muted">
              Sincronize o Todoist para importar seus workspaces.
            </p>
            <Link
              href="/configuracoes/todoist"
              className="mt-2 inline-flex h-9 items-center rounded-md grad-jade px-4 text-sm font-medium text-text-inverse"
            >
              Configurar Todoist
            </Link>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={espacos.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {espacos.map((e, i) => (
                  <EspacoItem key={e.id} espaco={e} posicao={i + 1} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {/* Organizar projetos dentro dos espaços — opcional */}
        <div className="mt-8 rounded-md border border-border-strong bg-bg-elevated p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Organizar projetos</p>
              <p className="text-xs text-text-muted">
                Opcional — ajuste multiplicadores por projeto.
              </p>
            </div>
            <Link
              href="/projetos"
              className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-bg-surface px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Ver projetos <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function EspacoItem({ espaco, posicao }: { espaco: EspacoRow; posicao: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: espaco.id,
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
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-bg-elevated p-3',
        espaco.ativo ? 'border-border-strong' : 'border-border opacity-60',
      )}
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
      <Briefcase className="h-5 w-5 shrink-0 text-jade-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{espaco.nome}</p>
        {espaco.todoist_id && (
          <p className="text-[10px] text-text-muted">Sincronizado do Todoist</p>
        )}
      </div>
      {!espaco.ativo && (
        <span className="rounded-full bg-bg-surface px-2 py-0.5 text-[10px] text-text-muted">
          Inativo
        </span>
      )}
    </li>
  );
}
