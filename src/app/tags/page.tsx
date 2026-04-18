'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type TipoPeso = 'multiplicador' | 'soma' | 'subtracao' | 'percentual' | 'peso_custom';

interface TagRow {
  id: string;
  todoist_id: string | null;
  nome: string;
  cor: string;
  tipo_peso: TipoPeso;
  valor_peso: number;
  ativo: boolean;
}

const TIPOS: { value: TipoPeso; label: string; ajuda: string }[] = [
  { value: 'multiplicador', label: '× multiplicador', ajuda: 'nota × valor. Ex: 1.25 sobe 25%.' },
  { value: 'soma', label: '+ soma', ajuda: 'nota + valor.' },
  { value: 'subtracao', label: '− subtração', ajuda: 'nota − valor.' },
  { value: 'percentual', label: '% percentual', ajuda: 'nota × (1 + valor%).' },
  { value: 'peso_custom', label: 'ignorar', ajuda: 'não afeta a nota.' },
];

export default function TagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/tags');
        const body = (await res.json()) as { tags: TagRow[] };
        setTags(body.tags.map((t) => ({ ...t, valor_peso: Number(t.valor_peso) })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const patch = (id: string, campo: keyof TagRow, valor: unknown) => {
    setTags((cur) => cur.map((t) => (t.id === id ? { ...t, [campo]: valor } : t)));
  };

  const salvar = async () => {
    setSalvando(true);
    setMensagem(null);
    try {
      const res = await fetch('/api/tags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tags: tags.map((t) => ({
            id: t.id,
            tipo_peso: t.tipo_peso,
            valor_peso: t.valor_peso,
            ativo: t.ativo,
          })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMensagem('Tags salvas.');
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
            <h1 className="text-lg font-semibold">Tags (labels do Todoist)</h1>
            <p className="text-xs text-text-muted">
              Configure como cada tag afeta a nota. {tags.length} tags.
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
              href="/tarefas"
              className="rounded-full border border-border-strong bg-bg-elevated px-3 py-1.5 font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Tarefas
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto mt-6 w-full max-w-3xl px-6">
        <div className="mb-4 rounded-md border border-jade-accent/40 bg-jade-dim/20 p-4 text-sm text-text-primary">
          <p>
            Multiplicadores empilham (×). Somas e subtrações somam. Percentuais somam entre si (ex: +15% e +10% = +25%).
          </p>
        </div>

        <ul className="space-y-2">
          {tags.map((t) => (
            <li
              key={t.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg border border-border-strong bg-bg-elevated p-3',
                !t.ativo && 'opacity-50',
              )}
            >
              <span
                className="h-6 w-6 shrink-0 rounded-full"
                style={{ background: t.cor }}
                aria-hidden
              />
              <div className="min-w-[160px] flex-1">
                <p className="text-sm font-medium">{t.nome}</p>
                {t.todoist_id && (
                  <p className="text-[10px] text-text-muted">Sync Todoist</p>
                )}
              </div>
              <select
                value={t.tipo_peso}
                onChange={(e) => patch(t.id, 'tipo_peso', e.target.value as TipoPeso)}
                className="h-9 rounded-md border border-border-strong bg-bg-surface px-2 text-sm outline-none focus:border-jade-accent"
                title={TIPOS.find((x) => x.value === t.tipo_peso)?.ajuda}
              >
                {TIPOS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step={0.05}
                value={t.valor_peso}
                onChange={(e) => patch(t.id, 'valor_peso', Number(e.target.value))}
                className="h-9 w-20 rounded-md border border-border-strong bg-bg-surface px-2 text-right text-sm font-semibold outline-none focus:border-jade-accent"
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={t.ativo}
                  onChange={(e) => patch(t.id, 'ativo', e.target.checked)}
                  className="h-3.5 w-3.5 accent-jade-accent"
                />
                ativa
              </label>
            </li>
          ))}
        </ul>
      </section>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg-deep/95 px-6 py-3 backdrop-blur-xl safe-bottom">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-text-secondary">
            {mensagem ?? 'Ajuste e salve. Depois recalcule as notas para refletir.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="inline-flex h-10 items-center rounded-md border border-border-strong bg-bg-elevated px-4 text-sm font-medium text-text-primary hover:bg-bg-hover disabled:opacity-40"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={recalcular}
              disabled={recalculando}
              className="inline-flex h-10 items-center gap-2 rounded-md grad-jade px-4 text-sm font-medium text-text-inverse disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', recalculando && 'animate-spin')} />
              {recalculando ? 'Recalculando…' : 'Recalcular notas'}
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
