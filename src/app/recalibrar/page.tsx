'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface KpisAgregados {
  periodo: string;
  totalMostradas: number;
  taxaReavaliacao: number;
  taxaDescarte: number;
  taxaAdiar: number;
  taxaPular: number;
  concluidasPorDia: number;
  taxaConclusao: number;
  streakMaximo: number;
}

interface Gatilho {
  codigo: string;
  label: string;
  valor: number;
  limiar: number;
}

interface Limiares {
  reavaliacao: number;
  descarte: number;
  adiamento: number;
}

interface DiagnosticoData {
  kpis: KpisAgregados;
  gatilhos: Gatilho[];
  deveRecalibrar: boolean;
  limiares: Limiares;
  ultimaRecalibracaoEm: string | null;
}

interface TarefaParaCalibrar {
  id: string;
  titulo: string;
  nota: number;
  importancia: number;
  urgencia: number;
  facilidade: number;
  faixa: 'alta' | 'media' | 'baixa';
}

interface ResultadoAplicar {
  pesosNovos: { urgencia: number; importancia: number; facilidade: number };
  correlacaoAntes: number;
  correlacaoDepois: number;
  amostras: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-[var(--bg-elevated)] ${className ?? 'h-24'}`} />
  );
}

// ─── Passo 1 — Diagnóstico ────────────────────────────────────────────────────

function KpiTile({
  label,
  valor,
  limiar,
  ativo,
  formato = 'pct',
}: {
  label: string;
  valor: number;
  limiar?: number;
  ativo?: boolean;
  formato?: 'pct' | 'num';
}) {
  const displayVal = formato === 'pct' ? pct(valor) : valor.toFixed(1);
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        ativo
          ? 'border-[var(--danger)] bg-[var(--danger)]/10'
          : 'border-[var(--border)] bg-[var(--bg-elevated)]'
      }`}
    >
      <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
      <p
        className={`text-2xl font-bold ${
          ativo ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'
        }`}
      >
        {displayVal}
      </p>
      {limiar !== undefined && (
        <p className="text-xs mt-1 text-[var(--text-muted)]">
          limiar: {formato === 'pct' ? pct(limiar) : limiar.toFixed(1)}
        </p>
      )}
    </div>
  );
}

function PassoDiagnostico({
  dados,
  onAvancar,
}: {
  dados: DiagnosticoData;
  onAvancar: () => void;
}) {
  const { kpis, gatilhos, deveRecalibrar, limiares, ultimaRecalibracaoEm } = dados;

  return (
    <motion.div
      key="diagnostico"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Diagnóstico</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Análise dos seus padrões dos últimos {kpis.periodo}
        </p>
        {ultimaRecalibracaoEm && (
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Última recalibração: {new Date(ultimaRecalibracaoEm).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>

      {deveRecalibrar && (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4">
          <AlertTriangle size={18} className="shrink-0 text-[var(--danger)] mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[var(--danger)]">
              Seus padrões mudaram — vale recalibrar
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {gatilhos.map((g) => g.label).join(' · ')}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <KpiTile label="Taxa de conclusão" valor={kpis.taxaConclusao} formato="pct" />
        <KpiTile label="Taxa de pular" valor={kpis.taxaPular} formato="pct" />
        <KpiTile
          label="Taxa de adiar"
          valor={kpis.taxaAdiar}
          limiar={limiares.adiamento / 100}
          ativo={gatilhos.some((g) => g.codigo === 'adiamento')}
          formato="pct"
        />
        <KpiTile
          label="Taxa de descarte"
          valor={kpis.taxaDescarte}
          limiar={limiares.descarte / 100}
          ativo={gatilhos.some((g) => g.codigo === 'descarte')}
          formato="pct"
        />
        <KpiTile
          label="Taxa de reavaliação"
          valor={kpis.taxaReavaliacao}
          limiar={limiares.reavaliacao / 100}
          ativo={gatilhos.some((g) => g.codigo === 'reavaliacao')}
          formato="pct"
        />
        <KpiTile label="Concluídas/dia" valor={kpis.concluidasPorDia} formato="num" />
        <KpiTile label="Streak máximo" valor={kpis.streakMaximo} formato="num" />
        <KpiTile label="Total mostradas" valor={kpis.totalMostradas} formato="num" />
      </div>

      <button
        type="button"
        onClick={onAvancar}
        className={`w-full h-12 rounded-xl font-semibold text-sm transition-all ${
          deveRecalibrar
            ? 'bg-gradient-to-r from-[var(--jade-primary)] to-[var(--jade-accent)] text-white animate-pulse-jade'
            : 'border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        {deveRecalibrar ? 'Começar recalibração' : 'Recalibrar mesmo assim'}
      </button>
    </motion.div>
  );
}

// ─── Passo 2 — Calibração das tarefas ─────────────────────────────────────────

function PassoCalibracao({
  tarefas,
  notas,
  onNota,
  onAvancar,
  onVoltar,
}: {
  tarefas: TarefaParaCalibrar[];
  notas: Record<string, number>;
  onNota: (id: string, v: number) => void;
  onAvancar: () => void;
  onVoltar: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next');

  const tarefa = tarefas[idx] ?? tarefas[0];
  const total = tarefas.length;
  const progresso = (idx / Math.max(total - 1, 1)) * 100;

  if (!tarefa) return null;

  const ir = (delta: number) => {
    setDir(delta > 0 ? 'next' : 'prev');
    setIdx((i) => Math.max(0, Math.min(total - 1, i + delta)));
  };

  const todasAvaliadas = tarefas.every((t) => notas[t.id] !== undefined);

  return (
    <motion.div
      key="calibracao"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Avalie as tarefas</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Quanto cada tarefa é importante pra você? (0 = nada, 100 = crítico)
        </p>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-[var(--text-muted)]">
          <span>
            {idx + 1} de {total}
          </span>
          <span>{Math.round(progresso)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[var(--jade-primary)] to-[var(--jade-accent)]"
            animate={{ width: `${progresso}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Card da tarefa */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`tarefa-${tarefa.id}`}
          initial={{ opacity: 0, x: dir === 'next' ? 60 : -60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir === 'next' ? -60 : 60 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-5"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-medium text-[var(--text-primary)] leading-snug flex-1">
              {tarefa.titulo}
            </p>
            <span
              className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                tarefa.faixa === 'alta'
                  ? 'bg-[var(--jade-dim)]/40 text-[var(--jade-accent)]'
                  : tarefa.faixa === 'media'
                    ? 'bg-[var(--warn)]/20 text-[var(--warn)]'
                    : 'bg-[var(--text-muted)]/20 text-[var(--text-muted)]'
              }`}
            >
              nota sistema: {tarefa.nota}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Sua avaliação</span>
              <span className="text-2xl font-bold text-[var(--jade-accent)]">
                {notas[tarefa.id] ?? 50}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={notas[tarefa.id] ?? 50}
              onChange={(e) => onNota(tarefa.id, Number(e.target.value))}
              className="w-full accent-[var(--jade-accent)] h-2 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
              <span>Não importa</span>
              <span>Crítico</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navegação */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => (idx === 0 ? onVoltar() : ir(-1))}
          className="flex items-center gap-2 h-11 px-4 rounded-xl border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm"
        >
          <ArrowLeft size={15} />
          {idx === 0 ? 'Voltar' : 'Anterior'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (idx < total - 1) {
              ir(1);
            } else {
              onAvancar();
            }
          }}
          disabled={notas[tarefa.id] === undefined && idx === total - 1 && !todasAvaliadas}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-gradient-to-r from-[var(--jade-primary)] to-[var(--jade-accent)] text-white font-medium text-sm disabled:opacity-40 transition-opacity"
        >
          {idx < total - 1 ? (
            <>
              Próxima <ArrowRight size={15} />
            </>
          ) : (
            <>
              Ver proposta <ArrowRight size={15} />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Passo 3 — Proposta de pesos ──────────────────────────────────────────────

interface PesosAtuais {
  urgencia: number;
  importancia: number;
  facilidade: number;
}

function BarraPeso({
  label,
  valorAntigo,
  valorNovo,
}: {
  label: string;
  valorAntigo: number;
  valorNovo: number;
}) {
  const pctAntigo = valorAntigo * 100;
  const pctNovo = valorNovo * 100;
  const subiu = pctNovo > pctAntigo;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
          <span className="text-[var(--text-muted)] line-through text-xs">
            {pctAntigo.toFixed(0)}%
          </span>
          {subiu ? (
            <TrendingUp size={13} className="text-[var(--jade-accent)]" />
          ) : pctNovo < pctAntigo ? (
            <TrendingDown size={13} className="text-[var(--danger)]" />
          ) : null}
          <span
            className={
              subiu
                ? 'text-[var(--jade-accent)]'
                : pctNovo < pctAntigo
                  ? 'text-[var(--danger)]'
                  : ''
            }
          >
            {pctNovo.toFixed(0)}%
          </span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[var(--jade-primary)] to-[var(--jade-accent)]"
          initial={{ width: `${pctAntigo}%` }}
          animate={{ width: `${pctNovo}%` }}
          transition={{ duration: 0.6, ease: [0, 0, 0.2, 1] }}
        />
      </div>
    </div>
  );
}

function PassoProposta({
  pesosAtuais,
  pesosNovos,
  correlacaoAntes,
  correlacaoDepois,
  onAplicar,
  onCancelar,
  aplicando,
}: {
  pesosAtuais: PesosAtuais;
  pesosNovos: PesosAtuais;
  correlacaoAntes: number;
  correlacaoDepois: number;
  onAplicar: () => Promise<void>;
  onCancelar: () => void;
  aplicando: boolean;
}) {
  const melhora = correlacaoDepois - correlacaoAntes;

  return (
    <motion.div
      key="proposta"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Novos pesos</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Calculados a partir das suas avaliações via regressão linear.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-5">
        <BarraPeso
          label="Urgência"
          valorAntigo={pesosAtuais.urgencia}
          valorNovo={pesosNovos.urgencia}
        />
        <BarraPeso
          label="Importância"
          valorAntigo={pesosAtuais.importancia}
          valorNovo={pesosNovos.importancia}
        />
        <BarraPeso
          label="Facilidade"
          valorAntigo={pesosAtuais.facilidade}
          valorNovo={pesosNovos.facilidade}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-center">
          <p className="text-xs text-[var(--text-muted)] mb-1">Correlação antes</p>
          <p className="text-2xl font-bold text-[var(--text-secondary)]">
            {(correlacaoAntes * 100).toFixed(0)}%
          </p>
        </div>
        <div className="rounded-xl border border-[var(--jade-primary)]/40 bg-[var(--jade-dim)]/20 p-4 text-center">
          <p className="text-xs text-[var(--text-muted)] mb-1">Correlação depois</p>
          <p className="text-2xl font-bold text-[var(--jade-accent)]">
            {(correlacaoDepois * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {melhora > 0.01 && (
        <p className="text-center text-sm text-[var(--jade-accent)]">
          +{(melhora * 100).toFixed(0)}% de alinhamento com suas preferências
        </p>
      )}

      <div className="flex flex-col gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => void onAplicar()}
          disabled={aplicando}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-[var(--jade-primary)] to-[var(--jade-accent)] text-white font-semibold text-sm disabled:opacity-60 transition-opacity animate-pulse-jade"
        >
          {aplicando ? 'Aplicando…' : 'Aplicar novos pesos'}
        </motion.button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={aplicando}
          className="w-full h-11 rounded-xl border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-colors"
        >
          Cancelar
        </button>
      </div>
    </motion.div>
  );
}

// ─── Tela de sucesso ──────────────────────────────────────────────────────────

function TelaSucesso() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
      className="flex flex-col items-center gap-6 text-center py-12"
    >
      <motion.div
        animate={{
          boxShadow: ['0 0 0 0 rgba(44,175,147,0.4)', '0 0 0 24px rgba(44,175,147,0)'],
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="rounded-full p-4 bg-[var(--jade-dim)]/40"
      >
        <CheckCircle2 size={52} className="text-[var(--jade-accent)]" />
      </motion.div>
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Recalibração concluída!
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          Seus pesos foram atualizados e as notas estão sendo recalculadas.
        </p>
      </div>
      <p className="text-xs text-[var(--text-muted)]">Redirecionando para os cards…</p>
    </motion.div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type Passo = 'diagnostico' | 'calibracao' | 'proposta' | 'sucesso';

export default function RecalibrarPage() {
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>('diagnostico');
  const [carregandoDiagnostico, setCarregandoDiagnostico] = useState(true);
  const [carregandoTarefas, setCarregandoTarefas] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const [diagnostico, setDiagnostico] = useState<DiagnosticoData | null>(null);
  const [tarefas, setTarefas] = useState<TarefaParaCalibrar[]>([]);
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [erroDiagnostico, setErroDiagnostico] = useState<string | null>(null);
  const [erroTarefas, setErroTarefas] = useState<string | null>(null);
  const [erroAplicar, setErroAplicar] = useState<string | null>(null);

  // Pesos atuais e resultado da aplicação
  const [pesosAtuais, setPesosAtuais] = useState<PesosAtuais>({
    urgencia: 0.4,
    importancia: 0.4,
    facilidade: 0.2,
  });
  const [resultado, setResultado] = useState<ResultadoAplicar | null>(null);

  // Ref para evitar double-fetch no StrictMode
  const fetchedDiagnostico = useRef(false);

  useEffect(() => {
    if (fetchedDiagnostico.current) return;
    fetchedDiagnostico.current = true;
    void (async () => {
      try {
        const res = await fetch('/api/recalibrar/gatilhos');
        if (!res.ok) throw new Error('Erro ao carregar diagnóstico');
        const data = (await res.json()) as DiagnosticoData;
        setDiagnostico(data);
      } catch (e) {
        setErroDiagnostico(e instanceof Error ? e.message : 'Erro desconhecido');
      } finally {
        setCarregandoDiagnostico(false);
      }
    })();
  }, []);

  // Busca pesos atuais ao montar
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/configuracoes');
        if (!res.ok) return;
        const body = (await res.json()) as { configuracoes: Record<string, unknown> };
        const c = body.configuracoes;
        if (c) {
          setPesosAtuais({
            urgencia: Number(c.peso_urgencia ?? 0.4),
            importancia: Number(c.peso_importancia ?? 0.4),
            facilidade: Number(c.peso_facilidade ?? 0.2),
          });
        }
      } catch {
        // silencioso — fallback nos defaults
      }
    })();
  }, []);

  const irParaCalibracao = async () => {
    setCarregandoTarefas(true);
    setErroTarefas(null);
    try {
      const res = await fetch('/api/recalibrar/tarefas');
      if (!res.ok) throw new Error('Erro ao buscar tarefas');
      const body = (await res.json()) as { tarefas: TarefaParaCalibrar[] };
      if (!body.tarefas || body.tarefas.length === 0) {
        throw new Error('Nenhuma tarefa pendente encontrada.');
      }
      setTarefas(body.tarefas);
      // Inicializa notas com 50
      const init: Record<string, number> = {};
      for (const t of body.tarefas) {
        init[t.id] = 50;
      }
      setNotas(init);
      setPasso('calibracao');
    } catch (e) {
      setErroTarefas(e instanceof Error ? e.message : 'Erro');
    } finally {
      setCarregandoTarefas(false);
    }
  };

  const irParaProposta = () => {
    setPasso('proposta');
  };

  const aplicarPesos = async () => {
    setAplicando(true);
    setErroAplicar(null);
    try {
      const amostras = tarefas.map((t) => ({
        tarefaId: t.id,
        notaHumana: notas[t.id] ?? 50,
      }));
      const res = await fetch('/api/recalibrar/aplicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amostras }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error: string };
        throw new Error(body.error ?? 'Erro ao aplicar');
      }
      const r = (await res.json()) as ResultadoAplicar;
      setResultado(r);
      setPasso('sucesso');
      // Redirect após 2s
      setTimeout(() => {
        router.push('/cards');
      }, 2000);
    } catch (e) {
      setErroAplicar(e instanceof Error ? e.message : 'Erro ao aplicar pesos');
    } finally {
      setAplicando(false);
    }
  };

  const tituloPasso = {
    diagnostico: 'Diagnóstico',
    calibracao: 'Avalie as tarefas',
    proposta: 'Novos pesos',
    sucesso: 'Concluído',
  };

  return (
    <main className="min-h-dvh pb-24 safe-top safe-bottom">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-deep)]/80 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center gap-4">
          {passo !== 'sucesso' && (
            <Link
              href="/cards"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Recalibração</h1>
            <p className="text-xs text-[var(--text-muted)]">{tituloPasso[passo]}</p>
          </div>
          {/* Indicador de passos */}
          {passo !== 'sucesso' && (
            <div className="flex gap-1.5">
              {(['diagnostico', 'calibracao', 'proposta'] as Passo[]).map((p, i) => (
                <div
                  key={p}
                  className={`h-1.5 rounded-full transition-all ${
                    p === passo
                      ? 'w-6 bg-[var(--jade-accent)]'
                      : i < ['diagnostico', 'calibracao', 'proposta'].indexOf(passo)
                        ? 'w-3 bg-[var(--jade-primary)]/60'
                        : 'w-3 bg-[var(--border-strong)]'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto mt-8 w-full max-w-md px-6">
        <AnimatePresence mode="wait">
          {passo === 'diagnostico' && (
            <>
              {carregandoDiagnostico && (
                <motion.div
                  key="skeleton-diagnostico"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <SkeletonBlock className="h-10" />
                  <SkeletonBlock className="h-20" />
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(6)].map((_, i) => (
                      <SkeletonBlock key={i} className="h-24" />
                    ))}
                  </div>
                  <SkeletonBlock className="h-12" />
                </motion.div>
              )}
              {!carregandoDiagnostico && erroDiagnostico && (
                <motion.div
                  key="erro-diagnostico"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 py-16 text-center"
                >
                  <X size={36} className="text-[var(--danger)]" />
                  <p className="text-sm text-[var(--text-secondary)]">{erroDiagnostico}</p>
                  <button
                    type="button"
                    onClick={() => {
                      fetchedDiagnostico.current = false;
                      setCarregandoDiagnostico(true);
                      setErroDiagnostico(null);
                    }}
                    className="flex items-center gap-2 text-sm text-[var(--jade-accent)] hover:underline"
                  >
                    <RefreshCw size={14} />
                    Tentar novamente
                  </button>
                </motion.div>
              )}
              {!carregandoDiagnostico && !erroDiagnostico && diagnostico && (
                <>
                  {carregandoTarefas ? (
                    <motion.div
                      key="loading-tarefas"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      <SkeletonBlock className="h-10" />
                      <SkeletonBlock className="h-48" />
                    </motion.div>
                  ) : (
                    <PassoDiagnostico
                      dados={diagnostico}
                      onAvancar={() => void irParaCalibracao()}
                    />
                  )}
                  {erroTarefas && (
                    <p className="mt-3 text-center text-sm text-[var(--danger)]">{erroTarefas}</p>
                  )}
                </>
              )}
            </>
          )}

          {passo === 'calibracao' && tarefas.length > 0 && (
            <PassoCalibracao
              key="calibracao"
              tarefas={tarefas}
              notas={notas}
              onNota={(id, v) => setNotas((prev) => ({ ...prev, [id]: v }))}
              onAvancar={irParaProposta}
              onVoltar={() => setPasso('diagnostico')}
            />
          )}

          {passo === 'proposta' && resultado === null && (
            <PassoProposta
              key="proposta"
              pesosAtuais={pesosAtuais}
              pesosNovos={
                // Calcula preview dos pesos com base nas notas
                // Será substituído pelo resultado real ao aplicar
                pesosAtuais
              }
              correlacaoAntes={0}
              correlacaoDepois={0}
              onAplicar={aplicarPesos}
              onCancelar={() => router.push('/cards')}
              aplicando={aplicando}
            />
          )}

          {passo === 'proposta' && resultado !== null && !aplicando && (
            <PassoProposta
              key="proposta-resultado"
              pesosAtuais={pesosAtuais}
              pesosNovos={resultado.pesosNovos}
              correlacaoAntes={resultado.correlacaoAntes}
              correlacaoDepois={resultado.correlacaoDepois}
              onAplicar={aplicarPesos}
              onCancelar={() => router.push('/cards')}
              aplicando={aplicando}
            />
          )}

          {passo === 'sucesso' && <TelaSucesso key="sucesso" />}
        </AnimatePresence>

        {erroAplicar && (
          <p className="mt-4 text-center text-sm text-[var(--danger)]">{erroAplicar}</p>
        )}
      </section>
    </main>
  );
}
