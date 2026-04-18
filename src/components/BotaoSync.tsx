'use client';

import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function BotaoSync({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sync = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/todoist/sync', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Erro');
      const r = body.resultado;
      setMsg(
        `✓ ${r.tarefasImportadas} novas, ${r.tarefasAtualizadas} atualizadas, ${r.preservadas} preservadas, ${r.ignoradas} ignoradas.`,
      );
      // Recarrega a página pra refletir
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={sync}
      disabled={loading}
      title={msg ?? 'Sincronizar com Todoist (pull)'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-jade-accent/40 bg-jade-dim/30 px-3 py-1.5 text-xs font-medium text-jade-accent transition-colors hover:bg-jade-dim/50 disabled:opacity-50',
        className,
      )}
    >
      <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
      {loading ? 'Sync...' : msg ?? 'Sync'}
    </button>
  );
}
