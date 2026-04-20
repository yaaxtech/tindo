'use client';

import { cn } from '@/lib/utils';
import { useToasts } from '@/stores/toasts';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Download,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unlink,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MeData {
  email: string;
  fullName: string;
  tz: string | null;
}

interface StatusData {
  conectado: boolean;
  ultimoSync: string | null;
  syncHabilitado: boolean;
  writebackHabilitado: boolean;
  contadores: { tarefas: number; projetos: number; tags: number };
  ultimasAcoes: Array<{
    id: string;
    acao: string;
    criadoEm: string;
    tarefaTitulo: string | null;
  }>;
}

interface LocalCount {
  count: number | null;
  loading: boolean;
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
  return `há ${Math.floor(h / 24)}d`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-bg-hover', className)} />
  );
}

function Toggle({
  label,
  descricao,
  valor,
  disabled,
  onChange,
}: {
  label: string;
  descricao?: string;
  valor: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      disabled={disabled}
      onClick={() => onChange(!valor)}
      className="flex w-full items-start justify-between gap-4 py-1 text-left disabled:opacity-50"
    >
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {descricao && <p className="mt-0.5 text-xs text-text-muted">{descricao}</p>}
      </div>
      <span
        className={cn(
          'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors',
          valor ? 'bg-jade' : 'bg-bg-hover',
        )}
      >
        <span
          className={cn(
            'h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            valor ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ConectarPanel — mostrado quando sem token
// ---------------------------------------------------------------------------

function ConectarPanel({ onConectado }: { onConectado: () => void }) {
  const [token, setToken] = useState('');
  const [testando, setTestando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const toast = useToasts((s) => s.push);

  const handleTestar = async () => {
    if (!token.trim()) return;
    setTestando(true);
    setErro(null);
    try {
      const res = await fetch('/api/todoist/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const body = (await res.json()) as { ok: boolean; detalhe?: string; erro?: string };
      if (!body.ok) {
        setErro(body.erro ?? 'Token inválido. Verifique e tente novamente.');
      } else {
        toast({ titulo: body.detalhe ?? 'Todoist conectado!', icone: 'ok' });
        onConectado();
      }
    } catch {
      setErro('Não foi possível conectar. Tente novamente.');
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="rounded-xl border border-border-strong bg-bg-elevated p-6 text-center">
      <div className="mb-4 flex justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-jade/10 text-jade-accent">
          <Link2 className="h-7 w-7" />
        </span>
      </div>
      <h2 className="mb-1 text-base font-semibold text-text-primary">Conecte sua conta Todoist</h2>
      <p className="mb-5 text-sm text-text-muted">
        Cole seu token de API do Todoist para habilitar importação, exportação e sync.
      </p>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Cole seu token aqui..."
        className="mb-3 w-full rounded-xl border border-border-strong bg-bg-deep px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-jade"
        onKeyDown={(e) => { if (e.key === 'Enter') { void handleTestar(); } }}
      />
      {erro && (
        <p className="mb-3 flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {erro}
        </p>
      )}
      <button
        type="button"
        onClick={() => void handleTestar()}
        disabled={testando || !token.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-jade px-4 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-jade-accent disabled:opacity-50"
      >
        {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        {testando ? 'Verificando...' : 'Conectar'}
      </button>
      <p className="mt-4 text-xs text-text-muted">
        Encontre seu token em{' '}
        <span className="text-jade-accent">todoist.com → Configurações → Integrações → API token</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SyncPanel — expansível no card Síncrono
// ---------------------------------------------------------------------------

function SyncPanel({
  status,
  syncing,
  savingToggle,
  onSync,
  onToggle,
  writebackWarn,
}: {
  status: StatusData;
  syncing: boolean;
  savingToggle: boolean;
  onSync: () => void;
  onToggle: (campo: 'todoist_sync_habilitado' | 'todoist_writeback_habilitado', v: boolean) => void;
  writebackWarn: boolean;
}) {
  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <Toggle
        label="Importar automaticamente"
        descricao={status.syncHabilitado ? 'Sincroniza a cada 5 minutos' : undefined}
        valor={status.syncHabilitado}
        disabled={savingToggle}
        onChange={(v) => onToggle('todoist_sync_habilitado', v)}
      />
      <Toggle
        label="Enviar ao concluir / editar aqui"
        descricao="Ações no TinDo refletem no Todoist"
        valor={status.writebackHabilitado}
        disabled={savingToggle}
        onChange={(v) => onToggle('todoist_writeback_habilitado', v)}
      />
      {(writebackWarn || status.writebackHabilitado) && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Ações no TinDo (concluir, editar, excluir) refletem em tempo real na sua conta Todoist.
        </p>
      )}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-text-muted">
          {status.ultimoSync ? tempoRelativo(status.ultimoSync) : 'Nunca sincronizado'}
        </p>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-lg bg-jade px-3 py-1.5 text-xs font-semibold text-text-inverse transition-colors hover:bg-jade-accent disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TodoistHubPage() {
  const [me, setMe] = useState<MeData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [conectado, setConectado] = useState(false);
  const [localCount, setLocalCount] = useState<LocalCount>({ count: null, loading: false });
  const [syncing, setSyncing] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [showDesconectar, setShowDesconectar] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [writebackWarn, setWritebackWarn] = useState(false);
  const [syncExpanded, setSyncExpanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toast = useToasts((s) => s.push);

  const carregarStatus = useCallback(async () => {
    try {
      const [meRes, stRes] = await Promise.all([
        fetch('/api/todoist/me'),
        fetch('/api/todoist/status'),
      ]);
      const stBody = (await stRes.json()) as StatusData;
      setStatus(stBody);
      if (meRes.ok) {
        const meBody = (await meRes.json()) as MeData;
        setMe(meBody);
        setConectado(true);
      } else {
        setConectado(false);
        setMe(null);
      }
    } catch {
      setConectado(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarLocalCount = useCallback(async () => {
    setLocalCount({ count: null, loading: true });
    try {
      const res = await fetch('/api/todoist/exportar/previa');
      if (res.ok) {
        const body = (await res.json()) as { total: number };
        setLocalCount({ count: body.total, loading: false });
      } else {
        setLocalCount({ count: 0, loading: false });
      }
    } catch {
      setLocalCount({ count: 0, loading: false });
    }
  }, []);

  useEffect(() => {
    void carregarStatus();
  }, [carregarStatus]);

  useEffect(() => {
    if (conectado) {
      void carregarLocalCount();
      intervalRef.current = setInterval(() => { void carregarStatus(); }, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [conectado, carregarStatus, carregarLocalCount]);

  const handleSync = async () => {
    if (!conectado) {
      toast({ titulo: 'Conecte o Todoist primeiro', icone: 'alerta' });
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch('/api/todoist/sync', { method: 'POST' });
      const body = (await res.json()) as { ok: boolean; importadas?: number; atualizadas?: number; error?: string };
      if (body.ok) {
        toast({
          titulo: `Sync concluído — ${body.importadas ?? 0} importadas, ${body.atualizadas ?? 0} atualizadas`,
          icone: 'ok',
        });
        await carregarStatus();
      } else {
        toast({ titulo: body.error ?? 'Erro ao sincronizar', icone: 'alerta' });
      }
    } catch {
      toast({ titulo: 'Falha ao sincronizar. Tente novamente.', icone: 'alerta' });
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async (campo: 'todoist_sync_habilitado' | 'todoist_writeback_habilitado', valor: boolean) => {
    if (!status) return;
    if (campo === 'todoist_writeback_habilitado' && valor && !status.writebackHabilitado) {
      setWritebackWarn(true);
    }
    setSavingToggle(true);
    try {
      const res = await fetch('/api/configuracoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: valor }),
      });
      if (res.ok) {
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                syncHabilitado: campo === 'todoist_sync_habilitado' ? valor : prev.syncHabilitado,
                writebackHabilitado:
                  campo === 'todoist_writeback_habilitado' ? valor : prev.writebackHabilitado,
              }
            : prev,
        );
      } else {
        toast({ titulo: 'Erro ao salvar configuração', icone: 'alerta' });
      }
    } catch {
      toast({ titulo: 'Erro ao salvar configuração', icone: 'alerta' });
    } finally {
      setSavingToggle(false);
    }
  };

  const handleDesconectar = async () => {
    setDesconectando(true);
    try {
      await fetch('/api/todoist/desconectar', { method: 'POST' });
      toast({ titulo: 'Todoist desconectado', icone: 'info' });
      setConectado(false);
      setMe(null);
      setStatus(null);
      setShowDesconectar(false);
    } catch {
      toast({ titulo: 'Erro ao desconectar', icone: 'alerta' });
    } finally {
      setDesconectando(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-deep px-4 py-8">
        <div className="mx-auto max-w-lg space-y-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Not connected
  // ---------------------------------------------------------------------------
  if (!conectado) {
    return (
      <div className="min-h-screen bg-bg-deep px-4 py-8">
        <div className="mx-auto max-w-lg space-y-6">
          <Link
            href="/configuracoes"
            className="flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Configurações
          </Link>
          <ConectarPanel onConectado={() => { void carregarStatus(); }} />
          <p className="text-center text-xs text-text-muted">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
            Seu token Todoist é armazenado criptografado e nunca compartilhado.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Connected — 3 action buttons + sync panel
  // ---------------------------------------------------------------------------
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.07, duration: 0.3, ease: 'easeOut' },
    }),
  };

  return (
    <div className="min-h-screen bg-bg-deep px-4 py-8">
      <div className="mx-auto max-w-lg space-y-5">
        {/* Back link */}
        <Link
          href="/configuracoes"
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Configurações
        </Link>

        {/* Header — conta conectada */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-jade/30 bg-jade/5 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-jade/20 text-sm font-bold text-jade-accent uppercase">
              {me?.fullName?.[0] ?? me?.email?.[0] ?? 'T'}
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{me?.fullName ?? me?.email}</p>
              <p className="flex items-center gap-1 text-xs text-jade-accent">
                <CircleCheck className="h-3 w-3" />
                Conectado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDesconectar(true)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-text-muted hover:bg-bg-hover hover:text-text-secondary"
          >
            <Unlink className="h-3.5 w-3.5" />
            Desconectar
          </button>
        </motion.div>

        {/* Confirm desconectar */}
        <AnimatePresence>
          {showDesconectar && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-xl border border-danger/30 bg-danger/5 px-4 py-3"
            >
              <p className="mb-3 text-sm text-text-primary">
                Desconectar removerá o token e desativará o sync automático. Suas tarefas importadas
                permanecerão.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleDesconectar()}
                  disabled={desconectando}
                  className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger/90 disabled:opacity-50"
                >
                  {desconectando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setShowDesconectar(false)}
                  className="rounded-lg border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-bg-hover"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ——— 3 botões de ação ——— */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

          {/* IMPORTAR */}
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="flex flex-col rounded-xl border border-border-strong bg-bg-elevated p-5"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-jade/10">
              <Download className="h-5 w-5 text-jade-accent" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary">Importar</h2>
            <p className="mt-1 mb-4 text-xs text-text-muted flex-1">
              Traga tarefas, projetos e tags do Todoist para o TinDo.
            </p>

            {/* Contador */}
            {status && status.ultimoSync ? (
              <div className="mb-4 grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Tarefas', v: status.contadores.tarefas },
                  { label: 'Projetos', v: status.contadores.projetos },
                  { label: 'Tags', v: status.contadores.tags },
                ].map(({ label, v }) => (
                  <div key={label} className="rounded-lg border border-border bg-bg-deep p-1.5 text-center">
                    <p className="text-sm font-bold text-jade-accent">{v}</p>
                    <p className="text-[10px] text-text-muted">{label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-4 text-xs text-text-muted italic">Ainda não importado</p>
            )}

            <Link
              href="/configuracoes/todoist/importar"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-jade px-4 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-jade-accent"
            >
              <Download className="h-4 w-4" />
              {status?.ultimoSync ? 'Reimportar' : 'Importar agora'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          {/* EXPORTAR */}
          <motion.div
            custom={1}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="flex flex-col rounded-xl border border-border-strong bg-bg-elevated p-5"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-jade/10">
              <Upload className="h-5 w-5 text-jade-accent" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary">Exportar</h2>
            <p className="mt-1 mb-4 text-xs text-text-muted flex-1">
              Envie tarefas locais para o Todoist ou baixe um backup.
            </p>

            {/* Contador */}
            <div className="mb-4 rounded-lg border border-border bg-bg-deep p-2 text-center">
              {localCount.loading ? (
                <Skeleton className="mx-auto h-4 w-20" />
              ) : (
                <>
                  <p className="text-sm font-bold text-jade-accent">
                    {localCount.count ?? 0}
                  </p>
                  <p className="text-[10px] text-text-muted">pendentes</p>
                </>
              )}
            </div>

            <Link
              href="/configuracoes/todoist/exportar"
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
                localCount.count
                  ? 'bg-jade text-text-inverse hover:bg-jade-accent'
                  : 'border border-border-strong bg-bg-surface text-text-muted hover:bg-bg-hover',
              )}
            >
              <Upload className="h-4 w-4" />
              {localCount.count ? `Exportar ${localCount.count}` : 'Ver tarefas'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          {/* MANTER SÍNCRONO */}
          <motion.div
            custom={2}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="flex flex-col rounded-xl border border-border-strong bg-bg-elevated p-5"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-jade/10">
              <RefreshCw className={cn('h-5 w-5 text-jade-accent', syncing && 'animate-spin')} />
            </div>
            <h2 className="text-sm font-semibold text-text-primary">Manter Síncrono</h2>
            <p className="mt-1 mb-4 text-xs text-text-muted flex-1">
              Mantenha TinDo e Todoist espelhados automaticamente.
            </p>

            {/* Status rápido */}
            <div className="mb-4 rounded-lg border border-border bg-bg-deep px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Auto-sync</span>
                <span className={cn('font-semibold', status?.syncHabilitado ? 'text-jade-accent' : 'text-text-muted')}>
                  {status?.syncHabilitado ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-text-muted">Write-back</span>
                <span className={cn('font-semibold', status?.writebackHabilitado ? 'text-jade-accent' : 'text-text-muted')}>
                  {status?.writebackHabilitado ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSyncExpanded((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-jade px-4 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-jade-accent"
            >
              <RefreshCw className="h-4 w-4" />
              Configurar sync
              <ArrowRight className={cn('h-4 w-4 transition-transform', syncExpanded && 'rotate-90')} />
            </button>
          </motion.div>
        </div>

        {/* Painel de sync expandível */}
        <AnimatePresence>
          {syncExpanded && status && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-jade/30 bg-bg-elevated p-5">
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <RefreshCw className="h-4 w-4 text-jade-accent" />
                  Configurações de sincronização
                </h3>
                <p className="mb-1 text-xs text-text-muted">
                  Controle como TinDo e Todoist trocam dados.
                </p>
                <SyncPanel
                  status={status}
                  syncing={syncing}
                  savingToggle={savingToggle}
                  onSync={() => void handleSync()}
                  onToggle={(campo, v) => void handleToggle(campo, v)}
                  writebackWarn={writebackWarn}
                />
                <Link
                  href="/configuracoes/todoist/status"
                  className="mt-3 block text-xs text-text-muted hover:text-text-secondary"
                >
                  Ver histórico completo →
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <p className="pb-4 text-center text-xs text-text-muted">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
          Seu token Todoist é armazenado criptografado e nunca compartilhado.
        </p>
      </div>
    </div>
  );
}
