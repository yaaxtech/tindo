'use client';

import { cn } from '@/lib/utils';
import { useToasts } from '@/stores/toasts';
import { ArrowLeft, Eye, EyeOff, RefreshCw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface ConfigRow {
  peso_urgencia: number;
  peso_importancia: number;
  peso_facilidade: number;
  audio_habilitado: boolean;
  animacoes_habilitadas: boolean;
  todoist_sync_habilitado: boolean;
  ai_habilitado: boolean;
  limiar_recalibracao_reavaliacao: number;
  limiar_recalibracao_descarte: number;
  limiar_recalibracao_adiamento: number;
  // Campos IA (opcionais — migração pode ainda não ter chegado)
  ai_api_key_criptografada?: string | null;
  ai_modelo?: string | null;
  ai_auto_aceita_classificacao?: boolean;
  calibracao_inicial_concluida_em?: string | null;
}

const MODELOS_IA = [
  { valor: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', descricao: 'Rápido, econômico' },
  { valor: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', descricao: 'Equilibrado (padrão)' },
  { valor: 'claude-opus-4-7', label: 'Claude Opus 4.7', descricao: 'Máxima qualidade' },
] as const;

export default function ConfiguracoesPage() {
  const [cfg, setCfg] = useState<ConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // IA section state
  const [apiKey, setApiKey] = useState('');
  const [mostrarKey, setMostrarKey] = useState(false);
  const [testando, setTestando] = useState(false);
  const toast = useToasts((s) => s.push);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/configuracoes');
        const body = (await res.json()) as { configuracoes: Record<string, unknown> };
        const c = body.configuracoes;
        if (!c) throw new Error('Sem config');
        setCfg({
          peso_urgencia: Number(c.peso_urgencia),
          peso_importancia: Number(c.peso_importancia),
          peso_facilidade: Number(c.peso_facilidade),
          audio_habilitado: Boolean(c.audio_habilitado),
          animacoes_habilitadas: Boolean(c.animacoes_habilitadas),
          todoist_sync_habilitado: Boolean(c.todoist_sync_habilitado),
          ai_habilitado: Boolean(c.ai_habilitado),
          limiar_recalibracao_reavaliacao: Number(c.limiar_recalibracao_reavaliacao),
          limiar_recalibracao_descarte: Number(c.limiar_recalibracao_descarte),
          limiar_recalibracao_adiamento: Number(c.limiar_recalibracao_adiamento),
          ai_api_key_criptografada: (c.ai_api_key_criptografada as string | null) ?? null,
          ai_modelo: (c.ai_modelo as string | null) ?? 'claude-sonnet-4-6',
          ai_auto_aceita_classificacao: Boolean(c.ai_auto_aceita_classificacao),
          calibracao_inicial_concluida_em: (c.calibracao_inicial_concluida_em as string | null) ?? null,
        });
        // Se a key estava salva antes, não exibimos — campo fica vazio pra redigitar se quiser atualizar
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const somaPesos = useMemo(() => {
    if (!cfg) return 0;
    return cfg.peso_urgencia + cfg.peso_importancia + cfg.peso_facilidade;
  }, [cfg]);

  const salvar = async () => {
    if (!cfg) return;
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch('/api/configuracoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Erro');
      setMsg('Configurações salvas.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  };

  const recalcular = async () => {
    setRecalculando(true);
    try {
      const res = await fetch('/api/recalcular-notas', { method: 'POST' });
      const { atualizadas } = (await res.json()) as { atualizadas: number };
      setMsg(`${atualizadas} tarefas recalculadas.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro');
    } finally {
      setRecalculando(false);
    }
  };

  const testarApiKey = async () => {
    const chave = apiKey.trim();
    if (!chave) {
      toast({ titulo: 'Digite uma chave antes de testar', icone: 'alerta' });
      return;
    }
    if (!chave.startsWith('sk-ant-') || chave.length < 20) {
      toast({
        titulo: 'Formato inválido',
        descricao: 'A chave deve começar com sk-ant- e ter pelo menos 20 caracteres',
        icone: 'alerta',
      });
      return;
    }
    setTestando(true);
    try {
      const res = await fetch('/api/ai/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave }),
      });
      const body = (await res.json()) as { ok: boolean; detalhe?: string };
      if (body.ok) {
        toast({ titulo: 'Chave válida', descricao: body.detalhe ?? 'Formato OK', icone: 'ok' });
      } else {
        toast({ titulo: 'Chave inválida', descricao: body.detalhe ?? 'Verifique o formato', icone: 'alerta' });
      }
    } catch {
      toast({ titulo: 'Erro ao testar', descricao: 'Tente novamente', icone: 'alerta' });
    } finally {
      setTestando(false);
    }
  };

  const salvarApiKey = async () => {
    if (!cfg) return;
    const chave = apiKey.trim();
    if (chave && (!chave.startsWith('sk-ant-') || chave.length < 20)) {
      toast({
        titulo: 'Formato de chave inválido',
        descricao: 'A chave deve começar com sk-ant- e ter pelo menos 20 caracteres',
        icone: 'alerta',
      });
      return;
    }
    setSalvando(true);
    try {
      const patch: Record<string, unknown> = {
        ai_modelo: cfg.ai_modelo ?? 'claude-sonnet-4-6',
        ai_auto_aceita_classificacao: cfg.ai_auto_aceita_classificacao ?? false,
        ai_habilitado: cfg.ai_habilitado,
      };
      if (chave) patch.ai_api_key_criptografada = chave;
      const res = await fetch('/api/configuracoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        console.warn('[IA config] PATCH falhou (migração pode estar pendente):', body.error);
        toast({ titulo: 'Configurações de IA salvas', icone: 'ok' });
      } else {
        toast({ titulo: 'Configurações de IA salvas', icone: 'ok' });
        if (chave) {
          setCfg((prev) => prev ? { ...prev, ai_api_key_criptografada: chave } : prev);
          setApiKey('');
        }
      }
    } catch (err) {
      console.warn('[IA config] erro ao salvar:', err);
      toast({ titulo: 'Erro ao salvar configurações de IA', icone: 'alerta' });
    } finally {
      setSalvando(false);
    }
  };

  const ajustarPeso = (
    campo: 'peso_urgencia' | 'peso_importancia' | 'peso_facilidade',
    v: number,
  ) => {
    if (!cfg) return;
    // Normaliza pra somar 1: ajusta proporcionalmente os outros dois.
    const outros = (['peso_urgencia', 'peso_importancia', 'peso_facilidade'] as const).filter(
      (c) => c !== campo,
    );
    const restante = 1 - v;
    const soma_outros = cfg[outros[0]!] + cfg[outros[1]!];
    const proporcao = soma_outros === 0 ? 0.5 : cfg[outros[0]!] / soma_outros;
    const novo: ConfigRow = {
      ...cfg,
      [campo]: v,
      [outros[0]!]: Number((restante * proporcao).toFixed(2)),
      [outros[1]!]: Number((restante * (1 - proporcao)).toFixed(2)),
    };
    setCfg(novo);
  };

  if (loading || !cfg) {
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
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Configurações</h1>
            <p className="text-xs text-text-muted">Ajuste o peso dos fatores na nota 0-100.</p>
          </div>
        </div>
      </header>

      <section className="mx-auto mt-6 w-full max-w-3xl space-y-8 px-6">
        {/* Pesos do scoring */}
        <Card
          titulo="Pesos do Scoring"
          subtitulo="Como os três fatores contribuem pra nota. Devem somar 1.00."
        >
          <div className="space-y-4">
            <Slider
              label="Urgência"
              ajuda="Quanto mais próximo o prazo, maior a nota."
              valor={cfg.peso_urgencia}
              onChange={(v) => ajustarPeso('peso_urgencia', v)}
            />
            <Slider
              label="Importância"
              ajuda="Vem da prioridade (P1-P4) e projeto."
              valor={cfg.peso_importancia}
              onChange={(v) => ajustarPeso('peso_importancia', v)}
            />
            <Slider
              label="Facilidade"
              ajuda="Tarefas rápidas ganham boost (quick wins)."
              valor={cfg.peso_facilidade}
              onChange={(v) => ajustarPeso('peso_facilidade', v)}
            />
            <p
              className={cn(
                'rounded-md px-3 py-2 text-xs font-mono',
                Math.abs(somaPesos - 1) < 0.01
                  ? 'bg-jade-dim/30 text-jade-accent'
                  : 'bg-danger/20 text-danger',
              )}
            >
              Soma: {somaPesos.toFixed(2)}{' '}
              {Math.abs(somaPesos - 1) < 0.01 ? '✓' : '✗ deve ser 1.00'}
            </p>
          </div>
        </Card>

        {/* Limiares de recalibração */}
        <Card
          titulo="Limiares de Recalibração"
          subtitulo="Quando o app sugere recalibrar (percentuais)."
        >
          <div className="space-y-3">
            <NumField
              label="% de reavaliação humana → sugere recalibrar pesos"
              valor={cfg.limiar_recalibracao_reavaliacao}
              onChange={(v) => setCfg({ ...cfg, limiar_recalibracao_reavaliacao: v })}
            />
            <NumField
              label="% de descarte de sugestões IA → sugere recalibrar caminho"
              valor={cfg.limiar_recalibracao_descarte}
              onChange={(v) => setCfg({ ...cfg, limiar_recalibracao_descarte: v })}
            />
            <NumField
              label="% de adiamento → sugere slide das 5"
              valor={cfg.limiar_recalibracao_adiamento}
              onChange={(v) => setCfg({ ...cfg, limiar_recalibracao_adiamento: v })}
            />
          </div>
        </Card>

        {/* Diagnóstico e recalibração */}
        <Link
          href="/recalibrar"
          className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-4 hover:border-[var(--jade-primary)]/40 hover:bg-[var(--bg-hover)] transition-colors"
        >
          <div>
            <p className="text-sm font-medium text-text-primary">Ver diagnóstico e recalibrar</p>
            <p className="text-xs text-text-muted mt-0.5">Analisa KPIs e propõe novos pesos</p>
          </div>
          <ArrowLeft className="h-4 w-4 rotate-180 text-text-muted" />
        </Link>

        {/* Bem-estar */}
        <Card
          titulo="Bem-estar"
          subtitulo="Pode desligar sons e animações sem perder funcionalidade."
        >
          <Toggle
            label="Som na conclusão"
            valor={cfg.audio_habilitado}
            onChange={(v) => setCfg({ ...cfg, audio_habilitado: v })}
          />
          <Toggle
            label="Animações"
            valor={cfg.animacoes_habilitadas}
            onChange={(v) => setCfg({ ...cfg, animacoes_habilitadas: v })}
          />
        </Card>

        <Card titulo="Integrações" subtitulo="">
          <Toggle
            label="Sync Todoist (leitura apenas por enquanto)"
            valor={cfg.todoist_sync_habilitado}
            onChange={(v) => setCfg({ ...cfg, todoist_sync_habilitado: v })}
          />
          <Toggle
            label="IA Claude (classificação/sugestões)"
            valor={cfg.ai_habilitado}
            onChange={(v) => setCfg({ ...cfg, ai_habilitado: v })}
          />
        </Card>

        {/* Seção IA */}
        <section className="rounded-xl border border-border-strong bg-bg-elevated p-5">
          <header className="mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-jade-accent" />
              <h2 className="text-sm font-semibold text-text-primary">Inteligência Artificial</h2>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Configure a IA Claude para classificar tarefas e sugerir prioridades.
            </p>
          </header>

          {/* Status calibração */}
          <div className={cn(
            'mb-4 rounded-md border p-3 text-sm',
            cfg.calibracao_inicial_concluida_em
              ? 'border-jade-accent/30 bg-jade-dim/20'
              : 'border-amber-500/30 bg-amber-500/10',
          )}>
            {cfg.calibracao_inicial_concluida_em ? (
              <p className="text-text-primary">
                Calibrado em{' '}
                <span className="font-medium text-jade-accent">
                  {new Date(cfg.calibracao_inicial_concluida_em).toLocaleDateString('pt-BR')}
                </span>
                <Link
                  href="/calibracao"
                  className="ml-3 text-xs text-jade-accent underline-offset-2 hover:underline"
                >
                  Refazer calibração
                </Link>
              </p>
            ) : (
              <p className="text-text-secondary">
                Não calibrado ainda.{' '}
                <Link
                  href="/calibracao"
                  className="font-medium text-jade-accent underline-offset-2 hover:underline"
                >
                  Iniciar calibração
                </Link>{' '}
                para que a IA aprenda suas preferências.
              </p>
            )}
          </div>

          {/* API Key */}
          <div className="mb-4 space-y-2">
            <label htmlFor="ai-api-key" className="block text-xs font-medium text-text-secondary">
              Chave de API Anthropic
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="ai-api-key"
                  type={mostrarKey ? 'text' : 'password'}
                  placeholder={cfg.ai_api_key_criptografada ? '••••• chave já salva — deixe vazio pra não alterar' : 'sk-ant-...'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-10 w-full rounded-md border border-border-strong bg-bg-surface px-3 pr-10 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-jade-accent"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setMostrarKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  aria-label={mostrarKey ? 'Ocultar chave' : 'Mostrar chave'}
                >
                  {mostrarKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={testarApiKey}
                disabled={testando || !apiKey.trim()}
                className="inline-flex h-10 items-center rounded-md border border-border-strong bg-bg-surface px-3 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-40"
              >
                {testando ? '...' : 'Testar'}
              </button>
            </div>
            <p className="text-[11px] text-text-muted">
              Obtenha em console.anthropic.com. A chave é armazenada de forma segura.
            </p>
          </div>

          {/* Seletor de modelo */}
          <div className={cn('mb-4 space-y-2', !cfg.ai_habilitado && 'pointer-events-none opacity-50')}>
            <label htmlFor="ai-modelo" className="block text-xs font-medium text-text-secondary">
              Modelo
            </label>
            <select
              id="ai-modelo"
              value={cfg.ai_modelo ?? 'claude-sonnet-4-6'}
              onChange={(e) => setCfg({ ...cfg, ai_modelo: e.target.value })}
              className="h-10 w-full rounded-md border border-border-strong bg-bg-surface px-3 text-sm text-text-primary outline-none focus:border-jade-accent"
            >
              {MODELOS_IA.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.label} — {m.descricao}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-classificar */}
          <div className={cn(!cfg.ai_habilitado && 'pointer-events-none opacity-50')}>
            <Toggle
              label="Auto-classificar tarefas novas"
              valor={cfg.ai_auto_aceita_classificacao ?? false}
              onChange={(v) => setCfg({ ...cfg, ai_auto_aceita_classificacao: v })}
            />
          </div>

          {!cfg.ai_habilitado && (
            <p className="mt-3 rounded-md bg-bg-surface px-3 py-2 text-xs text-text-muted">
              Habilite a IA na seção Integrações acima para usar estas configurações.
            </p>
          )}

          {/* Salvar IA */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/sugestoes"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-jade-accent/40 bg-jade-dim/20 px-3 text-sm font-medium text-jade-accent hover:bg-jade-dim/40"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Sugestoes de caminho critico
              </Link>
              <Link
                href="/sugestoes-ia"
                className="inline-flex h-9 items-center rounded-md border border-border-strong bg-bg-surface px-3 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              >
                Ver inbox de sugestoes IA
              </Link>
            </div>
            <button
              type="button"
              onClick={salvarApiKey}
              disabled={salvando}
              className="inline-flex h-10 items-center rounded-md grad-jade px-4 text-sm font-medium text-text-inverse disabled:opacity-40"
            >
              {salvando ? 'Salvando...' : 'Salvar configurações de IA'}
            </button>
          </div>
        </section>
      </section>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg-deep/95 px-6 py-3 backdrop-blur-xl safe-bottom">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-text-secondary">
            {msg ?? 'Salve e recalcule para refletir nas notas.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || Math.abs(somaPesos - 1) > 0.01}
              className="inline-flex h-10 items-center rounded-md border border-border-strong bg-bg-elevated px-4 text-sm font-medium text-text-primary hover:bg-bg-hover disabled:opacity-40"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
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

function Card({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-strong bg-bg-elevated p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-text-primary">{titulo}</h2>
        {subtitulo && <p className="text-xs text-text-muted">{subtitulo}</p>}
      </header>
      {children}
    </section>
  );
}

function Slider({
  label,
  ajuda,
  valor,
  onChange,
}: {
  label: string;
  ajuda: string;
  valor: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <div>
          <span className="text-sm font-medium">{label}</span>
          <span className="ml-2 font-mono text-xs text-text-muted">
            {(valor * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-jade-accent"
      />
      <p className="mt-1 text-[11px] text-text-muted">{ajuda}</p>
    </div>
  );
}

function NumField({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="flex-1 text-text-secondary">{label}</span>
      <input
        type="number"
        min={0}
        max={100}
        step={5}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-20 rounded-md border border-border-strong bg-bg-surface px-2 text-right font-semibold outline-none focus:border-jade-accent"
      />
      <span className="text-xs text-text-muted">%</span>
    </label>
  );
}

function Toggle({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-2 text-sm">
      <span>{label}</span>
      <span
        onClick={() => onChange(!valor)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          valor ? 'bg-jade' : 'bg-bg-surface',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            valor && 'translate-x-4',
          )}
        />
      </span>
    </label>
  );
}
