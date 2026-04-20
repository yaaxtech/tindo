'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface UltimaAcao {
  id: string;
  acao: string;
  dados: Record<string, unknown> | null;
  criadoEm: string;
  tarefaId: string | null;
  tarefaTitulo: string | null;
}

interface StatusData {
  conectado: boolean;
  ultimoSync: string | null;
  syncHabilitado: boolean;
  writebackHabilitado: boolean;
  contadores: {
    tarefas: number;
    projetos: number;
    tags: number;
  };
  ultimasAcoes: UltimaAcao[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function labelAcao(acao: string): string {
  const mapa: Record<string, string> = {
    sincronizado: 'Sincronizado',
    todoist_sync: 'Sync recebido',
    todoist_writeback: 'Write-back enviado',
    concluida: 'Concluída',
    adiada_manual: 'Adiada',
    adiada_auto: 'Adiamento auto',
  };
  return mapa[acao] ?? acao;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-bg-surface', className)} />;
}

// ---------------------------------------------------------------------------
// Card animado
// ---------------------------------------------------------------------------

function CardSection({
  titulo,
  children,
  delay = 0,
}: {
  titulo: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-xl border border-border-strong bg-bg-elevated p-5"
    >
      <h2 className="mb-4 text-sm font-semibold text-text-primary">{titulo}</h2>
      {children}
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Toggle inline
// ---------------------------------------------------------------------------

function ToggleInline({
  label,
  valor,
  onChange,
  descricao,
}: {
  label: string;
  valor: boolean;
  onChange: (v: boolean) => void;
  descricao?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <div>
        <p className="text-sm text-text-primary">{label}</p>
        {descricao && <p className="text-xs text-text-muted">{descricao}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={valor}
        onClick={() => onChange(!valor)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors',
          valor ? 'bg-jade' : 'bg-bg-surface border border-border-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-text-inverse shadow transition-transform',
            valor ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StatusTodoistPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [msgSync, setMsgSync] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch('/api/todoist/status');
      if (!res.ok) throw new Error('Erro ao carregar status');
      const data = (await res.json()) as StatusData;
      setStatus(data);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const sincronizar = async () => {
    setSincronizando(true);
    setMsgSync(null);
    try {
      const res = await fetch('/api/todoist/sync', { method: 'POST' });
      const body = (await res.json()) as {
        ok?: boolean;
        importadas?: number;
        atualizadas?: number;
        error?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error ?? 'Falha no sync');
      setMsgSync(`Concluído: ${body.importadas ?? 0} novas, ${body.atualizadas ?? 0} atualizadas`);
      await carregar();
    } catch (err) {
      setMsgSync(err instanceof Error ? err.message : 'Erro ao sincronizar');
    } finally {
      setSincronizando(false);
    }
  };

  const patchConfig = async (patch: {
    todoist_sync_habilitado?: boolean;
    todoist_writeback_habilitado?: boolean;
  }) => {
    if (!status) return;
    // Otimista
    setStatus((prev) => (prev ? { ...prev, ...patch } : prev));
    await fetch('/api/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  };

  // Empty state — nunca sincronizou
  if (!carregando && status && !status.ultimoSync && !status.conectado) {
    return (
      <div className="min-h-screen bg-bg-deep px-4 py-10">
        <div className="mx-auto max-w-lg">
          <Cabecalho />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-6 rounded-xl border border-border-strong bg-bg-elevated p-8 text-center"
          >
            <WifiOff className="h-12 w-12 text-text-muted" />
            <div>
              <p className="text-base font-semibold text-text-primary">Ainda não sincronizado</p>
              <p className="mt-1 text-sm text-text-muted">
                Configure sua conta Todoist e faça a primeira importação.
              </p>
            </div>
            <Link
              href="/configuracoes/todoist/importar"
              className="flex items-center gap-2 rounded-xl bg-jade px-5 py-2.5 text-sm font-semibold text-text-inverse hover:bg-jade-accent"
            >
              Fazer primeira importação
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-deep px-4 py-10">
      <div className="mx-auto max-w-lg space-y-4">
        <Cabecalho />

        {carregando ? (
          <SkeletonCards />
        ) : erro ? (
          <div className="flex items-start gap-2 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {erro}
          </div>
        ) : status ? (
          <>
            {/* Seção Conexão */}
            <CardSection titulo="Conexão" delay={0}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status.conectado ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-danger" />
                  )}
                  <span className="text-sm text-text-primary">
                    {status.conectado ? 'Token configurado' : 'Sem token configurado'}
                  </span>
                </div>
                <Link
                  href="/configuracoes/todoist/importar"
                  className="text-xs text-jade-accent hover:text-jade flex items-center gap-1"
                >
                  Reconectar
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </CardSection>

            {/* Seção Sincronização */}
            <CardSection titulo="Sincronização" delay={0.05}>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <Clock className="h-3.5 w-3.5" />
                    Última sincronização
                  </span>
                  <span className="text-text-primary">
                    {status.ultimoSync ? tempoRelativo(status.ultimoSync) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Próxima estimada</span>
                  <span className="text-text-muted text-xs">Diária às 06h UTC (cron)</span>
                </div>

                {msgSync && (
                  <p
                    className={cn(
                      'rounded-md px-3 py-2 text-xs',
                      msgSync.startsWith('Concluído')
                        ? 'bg-success/10 text-success'
                        : 'bg-danger/10 text-danger',
                    )}
                  >
                    {msgSync}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void sincronizar()}
                  disabled={sincronizando}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-jade/40 bg-jade/10 py-2 text-sm font-medium text-jade-accent hover:bg-jade/20 disabled:opacity-40"
                >
                  {sincronizando ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sincronizar agora
                    </>
                  )}
                </button>
              </div>
            </CardSection>

            {/* Seção Contadores */}
            <CardSection titulo="Dados sincronizados" delay={0.1}>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Tarefas', valor: status.contadores.tarefas },
                  { label: 'Projetos', valor: status.contadores.projetos },
                  { label: 'Tags', valor: status.contadores.tags },
                ].map(({ label, valor }) => (
                  <div
                    key={label}
                    className="rounded-lg border border-border bg-bg-surface p-3 text-center"
                  >
                    <p className="text-lg font-bold text-jade-accent">{valor}</p>
                    <p className="text-xs text-text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </CardSection>

            {/* Seção Últimas ações */}
            {status.ultimasAcoes.length > 0 && (
              <CardSection titulo="Últimas ações de sync" delay={0.15}>
                <ul className="divide-y divide-border">
                  {status.ultimasAcoes.map((a) => (
                    <li key={a.id} className="flex items-start justify-between py-2 gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text-primary truncate">
                          {a.tarefaTitulo ?? labelAcao(a.acao)}
                        </p>
                        {a.tarefaTitulo && (
                          <p className="text-[10px] text-text-muted">{labelAcao(a.acao)}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-text-muted">
                        {tempoRelativo(a.criadoEm)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardSection>
            )}

            {/* Seção Configurações */}
            <CardSection titulo="Configurações" delay={0.2}>
              <div className="space-y-4">
                <ToggleInline
                  label="Sync automático (leitura)"
                  descricao="Importa novas tarefas do Todoist periodicamente"
                  valor={status.syncHabilitado}
                  onChange={(v) => void patchConfig({ todoist_sync_habilitado: v })}
                />
                <ToggleInline
                  label="Write-back (escrita)"
                  descricao="Atualiza o Todoist ao concluir tarefas aqui"
                  valor={status.writebackHabilitado}
                  onChange={(v) => void patchConfig({ todoist_writeback_habilitado: v })}
                />
                <div className="pt-1 border-t border-border">
                  <Link
                    href="/configuracoes/todoist/importar"
                    className="flex items-center justify-between text-sm text-text-secondary hover:text-text-primary"
                  >
                    Reimportar do Todoist
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </CardSection>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Cabecalho() {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Status do Todoist</h1>
        <p className="mt-0.5 text-xs text-text-muted">Integração e sincronização</p>
      </div>
      <Link href="/configuracoes" className="text-xs text-text-muted hover:text-text-secondary">
        ← Configurações
      </Link>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border-strong bg-bg-elevated p-5">
          <Skeleton className="mb-4 h-4 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
