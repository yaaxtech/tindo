'use client';

import { cn } from '@/lib/utils';
import { useToasts } from '@/stores/toasts';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
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
  const [showLog, setShowLog] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [writebackWarn, setWritebackWarn] = useState(false);
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
    // Aviso na primeira ativação do writeback
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

  const handleBackup = () => {
    window.location.href = '/api/todoist/backup';
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08, duration: 0.3, ease: 'easeOut' },
    }),
  };

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-deep px-4 py-8">
        <div className="mx-auto max-w-lg space-y-4">
          <Skeleton className="h-16 w-full" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
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
  // Connected
  // ---------------------------------------------------------------------------
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

        {/* Card 1 — Importar */}
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="rounded-xl border border-border-strong bg-bg-elevated p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <Download className="h-4 w-4 text-jade-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Importar</h2>
          </div>
          <p className="mb-4 text-xs text-text-muted">
            Traga suas tarefas, projetos e tags do Todoist para o TinDo.
          </p>

          {!status?.ultimoSync ? (
            <Link
              href="/configuracoes/todoist/importar"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-jade px-4 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-jade-accent"
            >
              <Download className="h-4 w-4" />
              Começar importação
            </Link>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {[
                  { label: 'Tarefas', v: status.contadores.tarefas },
                  { label: 'Projetos', v: status.contadores.projetos },
                  { label: 'Tags', v: status.contadores.tags },
                ].map(({ label, v }) => (
                  <div key={label} className="rounded-lg border border-border bg-bg-deep p-2 text-center">
                    <p className="text-base font-bold text-jade-accent">{v}</p>
                    <p className="text-[10px] text-text-muted">{label}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/configuracoes/todoist/importar"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-surface px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
              >
                Reimportar novos itens
              </Link>
            </>
          )}

          {status && status.ultimasAcoes.length > 0 && (
            <button
              type="button"
              onClick={() => setShowLog(!showLog)}
              className="mt-2 text-xs text-text-muted hover:text-text-secondary"
            >
              {showLog ? 'Ocultar log' : 'Ver log de importações'}
            </button>
          )}

          <AnimatePresence>
            {showLog && status && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-border bg-bg-deep p-2">
                  {status.ultimasAcoes.slice(0, 10).map((a) => (
                    <div key={a.id} className="flex justify-between py-0.5 text-[11px]">
                      <span className="truncate text-text-secondary">
                        {a.tarefaTitulo ?? a.acao}
                      </span>
                      <span className="ml-2 shrink-0 text-text-muted">{tempoRelativo(a.criadoEm)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Card 2 — Exportar */}
        <motion.div
          custom={1}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="rounded-xl border border-border-strong bg-bg-elevated p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-jade-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Exportar</h2>
          </div>
          <p className="mb-4 text-xs text-text-muted">
            Envie tarefas locais para o Todoist ou baixe um backup completo.
          </p>

          {/* Sub-card: exportar pendentes */}
          <div className="mb-3 rounded-lg border border-border bg-bg-deep p-3">
            <p className="mb-1 text-xs font-medium text-text-secondary">Exportar pendentes para o Todoist</p>
            {localCount.loading ? (
              <Skeleton className="mb-2 h-4 w-40" />
            ) : (
              <p className="mb-2 text-xs text-text-muted">
                {localCount.count === null
                  ? 'Verificando...'
                  : localCount.count === 0
                  ? 'Todas as tarefas já estão no Todoist'
                  : `${localCount.count} tarefa${localCount.count !== 1 ? 's' : ''} local${localCount.count !== 1 ? 'is' : ''} ainda não ${localCount.count !== 1 ? 'estão' : 'está'} no Todoist`}
              </p>
            )}
            <Link
              href="/configuracoes/todoist/exportar"
              onClick={(e) => {
                if (!conectado) {
                  e.preventDefault();
                  toast({ titulo: 'Conecte o Todoist primeiro', icone: 'alerta' });
                }
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                localCount.count
                  ? 'bg-jade text-text-inverse hover:bg-jade-accent'
                  : 'border border-border-strong bg-bg-surface text-text-muted hover:bg-bg-hover',
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              {localCount.count ? `Exportar ${localCount.count} tarefas` : 'Ver tarefas locais'}
            </Link>
          </div>

          {/* Sub-card: backup JSON */}
          <div className="rounded-lg border border-border bg-bg-deep p-3">
            <p className="mb-1 text-xs font-medium text-text-secondary">Baixar backup JSON</p>
            <p className="mb-2 text-xs text-text-muted">
              Inclui tarefas, projetos, tags e configurações (sem tokens).
            </p>
            <button
              type="button"
              onClick={handleBackup}
              className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar backup agora
            </button>
          </div>
        </motion.div>

        {/* Card 3 — Sincronizar */}
        <motion.div
          custom={2}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="rounded-xl border border-border-strong bg-bg-elevated p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-jade-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Sincronizar</h2>
          </div>
          <p className="mb-4 text-xs text-text-muted">
            Mantenha TinDo e Todoist espelhados automaticamente.
          </p>

          <div className="space-y-4">
            <Toggle
              label="Importar do Todoist automaticamente"
              descricao={status?.syncHabilitado ? 'Sincroniza a cada 5 minutos via cron' : undefined}
              valor={status?.syncHabilitado ?? false}
              disabled={savingToggle}
              onChange={(v) => void handleToggle('todoist_sync_habilitado', v)}
            />

            <Toggle
              label="Enviar ao Todoist quando eu concluir/editar aqui"
              descricao="Ações no TinDo refletem em tempo real no Todoist"
              valor={status?.writebackHabilitado ?? false}
              disabled={savingToggle}
              onChange={(v) => void handleToggle('todoist_writeback_habilitado', v)}
            />

            {(writebackWarn || status?.writebackHabilitado) && (
              <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Ações no TinDo (concluir, editar, excluir) refletem em tempo real na sua conta Todoist.
              </p>
            )}
          </div>

          {/* Última sync */}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-text-muted">
              {status?.ultimoSync
                ? `Última sync: ${tempoRelativo(status.ultimoSync)}`
                : 'Nunca sincronizado'}
            </p>
            <button
              type="button"
              onClick={() => void handleSync()}
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

          <Link
            href="/configuracoes/todoist/status"
            className="mt-2 block text-xs text-text-muted hover:text-text-secondary"
          >
            Ver histórico completo →
          </Link>
        </motion.div>

        {/* Footer */}
        <p className="pb-4 text-center text-xs text-text-muted">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
          Seu token Todoist é armazenado criptografado e nunca compartilhado.
        </p>
      </div>
    </div>
  );
}
