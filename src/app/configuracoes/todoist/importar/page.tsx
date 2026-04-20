'use client';

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckSquare,
  Loader2,
  RefreshCw,
  Square,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface UserInfo {
  email: string;
  fullName: string;
  tz: string | null;
}

interface ProjetoPrevia {
  id: string;
  nome: string;
  count: number;
  cor: string;
}

interface PreviaData {
  projetosCount: number;
  tasksCount: number;
  tagsCount: number;
  projetos: ProjetoPrevia[];
}

interface SyncResultado {
  importadas: number;
  atualizadas: number;
  erros: number;
  duracaoMs: number;
  resultado?: {
    projetos: number;
    tags: number;
  };
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

const PASSOS = ['Conectar', 'Prévia', 'Importar', 'Concluído'];

function Stepper({ passo }: { passo: number }) {
  return (
    <nav aria-label="Etapas" className="mb-8 flex items-center justify-center gap-0">
      {PASSOS.map((label, i) => {
        const num = i + 1;
        const ativa = num === passo;
        const concluida = num < passo;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  ativa && 'bg-jade text-text-inverse',
                  concluida && 'bg-jade/30 text-jade-accent',
                  !ativa && !concluida && 'bg-bg-surface text-text-muted',
                )}
              >
                {concluida ? <Check className="h-4 w-4" /> : num}
              </div>
              <span
                className={cn(
                  'mt-1 text-[10px] font-medium',
                  ativa ? 'text-jade-accent' : 'text-text-muted',
                )}
              >
                {label}
              </span>
            </div>
            {i < PASSOS.length - 1 && (
              <div
                className={cn(
                  'mb-4 h-px w-10 transition-colors sm:w-16',
                  concluida ? 'bg-jade/40' : 'bg-border',
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
// Slide wrapper
// ---------------------------------------------------------------------------

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
};

// ---------------------------------------------------------------------------
// Passo 1 — Conectar
// ---------------------------------------------------------------------------

function Passo1({
  onProximo,
}: {
  onProximo: (user: UserInfo) => void;
}) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void verificarConexao();
  }, []);

  const verificarConexao = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch('/api/todoist/me');
      if (res.ok) {
        const data = (await res.json()) as UserInfo;
        setUserInfo(data);
      } else {
        setUserInfo(null);
      }
    } catch {
      setUserInfo(null);
    } finally {
      setCarregando(false);
    }
  };

  const testarToken = async (token: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch('/api/todoist/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = (await res.json()) as { ok: boolean; detalhe?: string; erro?: string };
      if (!res.ok || !body.ok) {
        setErro(body.erro ?? body.detalhe ?? 'Token inválido. Verifique e tente novamente.');
        setCarregando(false);
        return;
      }
      // Recarrega info do usuário após token salvo
      await verificarConexao();
    } catch {
      setErro('Não foi possível verificar o token. Tente novamente.');
      setCarregando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-jade-accent" />
        <p className="text-sm text-text-secondary">Verificando conexão...</p>
      </div>
    );
  }

  if (userInfo) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-jade/30 bg-jade/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-jade/20 text-jade-accent">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Conta conectada</p>
              <p className="text-xs text-text-secondary">{userInfo.email}</p>
            </div>
          </div>
          {userInfo.fullName && (
            <p className="mt-3 text-xs text-text-muted">
              Nome: <span className="text-text-secondary">{userInfo.fullName}</span>
              {userInfo.tz ? ` · Fuso: ${userInfo.tz}` : ''}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onProximo(userInfo)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-jade px-6 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-jade-accent"
        >
          Próximo
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={verificarConexao}
          className="text-center text-xs text-text-muted hover:text-text-secondary"
        >
          Reconectar com outro token
        </button>
      </div>
    );
  }

  return <FormToken onTestar={testarToken} erro={erro} />;
}

function FormToken({
  onTestar,
  erro,
}: {
  onTestar: (token: string) => void;
  erro: string | null;
}) {
  const [token, setToken] = useState('');
  const [testando, setTestando] = useState(false);

  const handleTestar = async () => {
    if (!token.trim()) return;
    setTestando(true);
    await onTestar(token.trim());
    setTestando(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border-strong bg-bg-elevated p-5">
        <p className="mb-1 text-sm font-medium text-text-primary">Token da API Todoist</p>
        <p className="mb-4 text-xs text-text-muted">
          Encontre em{' '}
          <span className="font-mono text-jade-accent">
            todoist.com → Configurações → Integrações → Token de API
          </span>
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Cole seu token aqui..."
          autoComplete="off"
          className="w-full rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-jade-accent"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleTestar();
          }}
        />
        {erro && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {erro}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => void handleTestar()}
        disabled={testando || !token.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-jade px-6 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-jade-accent disabled:opacity-40"
      >
        {testando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando...
          </>
        ) : (
          'Testar e conectar'
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Passo 2 — Prévia
// ---------------------------------------------------------------------------

function Passo2({
  onProximo,
}: {
  onProximo: (projetoIds: string[]) => void;
}) {
  const [previa, setPrevia] = useState<PreviaData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch('/api/todoist/previa');
      if (!res.ok) throw new Error('Não foi possível carregar a prévia');
      const data = (await res.json()) as PreviaData;
      setPrevia(data);
      setSelecionados(new Set(data.projetos.map((p) => p.id)));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar prévia');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const toggleProjeto = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (!previa) return;
    if (selecionados.size === previa.projetos.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(previa.projetos.map((p) => p.id)));
    }
  };

  if (carregando) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-jade-accent" />
        <p className="text-sm text-text-secondary">Carregando dados do Todoist...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {erro}
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          className="flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-elevated px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!previa) return null;

  const todosM = selecionados.size === previa.projetos.length;

  return (
    <div className="flex flex-col gap-5">
      {/* Tiles de resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Projetos', valor: previa.projetosCount },
          { label: 'Tarefas', valor: previa.tasksCount },
          { label: 'Tags', valor: previa.tagsCount },
        ].map(({ label, valor }) => (
          <div
            key={label}
            className="rounded-xl border border-border-strong bg-bg-elevated p-3 text-center"
          >
            <p className="text-xl font-bold text-jade-accent">{valor}</p>
            <p className="text-xs text-text-muted">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabela de projetos */}
      <div className="rounded-xl border border-border-strong bg-bg-elevated overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <p className="text-xs font-semibold text-text-secondary">Projetos a importar</p>
          <button
            type="button"
            onClick={toggleTodos}
            className="flex items-center gap-1 text-xs text-jade-accent hover:text-jade"
          >
            {todosM ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {todosM ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        </div>
        <ul className="divide-y divide-border max-h-56 overflow-y-auto">
          {previa.projetos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggleProjeto(p.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-hover"
              >
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: p.cor }}
                />
                <span className="flex-1 text-sm text-text-primary">{p.nome}</span>
                <span className="text-xs text-text-muted">{p.count} tarefas</span>
                {selecionados.has(p.id) ? (
                  <CheckSquare className="h-4 w-4 shrink-0 text-jade-accent" />
                ) : (
                  <Square className="h-4 w-4 shrink-0 text-text-muted" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => onProximo([...selecionados])}
        disabled={selecionados.size === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-jade px-6 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-jade-accent disabled:opacity-40"
      >
        Importar {selecionados.size} projeto{selecionados.size !== 1 ? 's' : ''}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Passo 3 — Importando
// ---------------------------------------------------------------------------

const LOG_MSGS = [
  'Conectando ao Todoist...',
  'Importando projetos...',
  'Importando tags...',
  'Importando tarefas pendentes...',
  'Classificando com IA...',
  'Finalizando...',
];

function Passo3({
  projetoIds,
  onConcluido,
}: {
  projetoIds: string[];
  onConcluido: (resultado: SyncResultado) => void;
}) {
  const primeiroLog = LOG_MSGS[0] ?? 'Iniciando...';
  const [logs, setLogs] = useState<string[]>([primeiroLog]);
  const [erro, setErro] = useState<string | null>(null);
  const [tentando, setTentando] = useState(false);

  const executar = async () => {
    setErro(null);
    setTentando(false);
    setLogs([primeiroLog]);

    // Anima os logs durante o sync
    let logIdx = 1;
    const logInterval = setInterval(() => {
      const msg = LOG_MSGS[logIdx];
      if (logIdx < LOG_MSGS.length && msg) {
        setLogs((prev) => [...prev.slice(-2), msg]);
        logIdx++;
      }
    }, 1800);

    try {
      const res = await fetch('/api/todoist/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projetoIds: projetoIds.length > 0 ? projetoIds : undefined }),
      });
      clearInterval(logInterval);

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Falha no sync');
      }

      const data = (await res.json()) as SyncResultado;
      setLogs((prev) => [...prev.slice(-2), 'Importação concluída!']);
      setTimeout(() => onConcluido(data), 600);
    } catch (err) {
      clearInterval(logInterval);
      setErro(err instanceof Error ? err.message : 'Erro durante a importação');
      setTentando(false);
    }
  };

  useEffect(() => {
    void executar();
  }, []);

  if (erro) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-start gap-2 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {erro}
        </div>
        <button
          type="button"
          disabled={tentando}
          onClick={() => {
            setTentando(true);
            void executar();
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-elevated px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-hover disabled:opacity-40"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      {/* Barra de progresso indeterminada */}
      <div className="w-full overflow-hidden rounded-full bg-bg-surface h-2">
        <motion.div
          className="h-full rounded-full bg-jade"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5, ease: 'easeInOut' }}
          style={{ width: '50%' }}
        />
      </div>

      {/* Log de atividade */}
      <div className="w-full rounded-xl border border-border-strong bg-bg-elevated px-4 py-3 min-h-[5rem]">
        <AnimatePresence mode="popLayout">
          {logs.map((msg, i) => (
            <motion.p
              key={`${msg}-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: i === logs.length - 1 ? 1 : 0.4 }}
              exit={{ opacity: 0 }}
              className="text-xs text-text-secondary"
            >
              {i === logs.length - 1 ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-jade-accent" />
                  {msg}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-jade-accent" />
                  {msg}
                </span>
              )}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>

      <p className="text-xs text-text-muted">Isso pode levar alguns segundos...</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Passo 4 — Sucesso
// ---------------------------------------------------------------------------

function Passo4({ resultado }: { resultado: SyncResultado }) {
  const [syncHabilitado, setSyncHabilitado] = useState(true);
  const [writebackHabilitado, setWritebackHabilitado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const salvarConfig = async (sync: boolean, writeback: boolean) => {
    setSalvando(true);
    try {
      await fetch('/api/configuracoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todoist_sync_habilitado: sync,
          todoist_writeback_habilitado: writeback,
        }),
      });
    } catch {
      // ignora — configuração pode ser ajustada depois
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Totais */}
      <div className="rounded-xl border border-jade/30 bg-jade/5 p-5 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-jade/20 text-jade-accent mx-auto mb-3">
          <Check className="h-6 w-6" />
        </div>
        <p className="text-lg font-bold text-text-primary">Importação concluída!</p>
        <p className="mt-1 text-sm text-text-secondary">
          {resultado.importadas} tarefa{resultado.importadas !== 1 ? 's' : ''} importada
          {resultado.importadas !== 1 ? 's' : ''}
          {resultado.resultado?.projetos ? ` · ${resultado.resultado.projetos} projetos` : ''}
          {resultado.resultado?.tags ? ` · ${resultado.resultado.tags} tags` : ''}
          {resultado.atualizadas > 0 ? ` · ${resultado.atualizadas} atualizadas` : ''}
        </p>
        {resultado.erros > 0 && (
          <p className="mt-1 text-xs text-warning">
            {resultado.erros} erro{resultado.erros !== 1 ? 's' : ''} (veja os logs)
          </p>
        )}
      </div>

      {/* Checkboxes de configuração */}
      <div className="rounded-xl border border-border-strong bg-bg-elevated p-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={syncHabilitado}
            onChange={(e) => {
              setSyncHabilitado(e.target.checked);
              void salvarConfig(e.target.checked, writebackHabilitado);
            }}
            className="mt-0.5 h-4 w-4 rounded accent-jade"
          />
          <div>
            <p className="text-sm font-medium text-text-primary">Ativar sincronização automática</p>
            <p className="text-xs text-text-muted">
              O Todoist é verificado periodicamente para novas tarefas
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={writebackHabilitado}
            onChange={(e) => {
              setWritebackHabilitado(e.target.checked);
              void salvarConfig(syncHabilitado, e.target.checked);
            }}
            className="mt-0.5 h-4 w-4 rounded accent-jade"
          />
          <div>
            <p className="text-sm font-medium text-text-primary">
              Atualizar Todoist ao concluir tarefas aqui
            </p>
            <p className="text-xs text-text-muted">
              Write-back opt-in — tarefas concluídas no TinDo refletem no Todoist
            </p>
          </div>
        </label>
      </div>

      {salvando && (
        <p className="text-center text-xs text-text-muted flex items-center justify-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Salvando preferências...
        </p>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-2">
        <Link
          href="/cards"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-jade px-6 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-jade-accent"
        >
          Ir para os cards
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/configuracoes"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-elevated px-6 py-2.5 text-sm text-text-secondary hover:bg-bg-hover"
        >
          Configurar depois
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principal (wizard)
// ---------------------------------------------------------------------------

export default function ImportarTodoistPage() {
  const [passo, setPasso] = useState(1);
  const [dir, setDir] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [projetoIds, setProjetoIds] = useState<string[]>([]);
  const [resultado, setResultado] = useState<SyncResultado | null>(null);

  const avancar = (novoPasso: number) => {
    setDir(1);
    setPasso(novoPasso);
  };

  return (
    <div className="min-h-screen bg-bg-deep px-4 py-8">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-center text-xl font-bold text-text-primary">
          Importar do Todoist
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
                  onProximo={(u) => {
                    setUserInfo(u);
                    avancar(2);
                  }}
                />
              )}
              {passo === 2 && (
                <Passo2
                  onProximo={(ids) => {
                    setProjetoIds(ids);
                    avancar(3);
                  }}
                />
              )}
              {passo === 3 && (
                <Passo3
                  projetoIds={projetoIds}
                  onConcluido={(r) => {
                    setResultado(r);
                    avancar(4);
                  }}
                />
              )}
              {passo === 4 && resultado && <Passo4 resultado={resultado} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
