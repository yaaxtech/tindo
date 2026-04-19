'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── tipos ────────────────────────────────────────────────────────────────────

type EstiloTrabalho = 'foco_profundo' | 'variedade' | 'reativo';
type TempoProdutivo = 'manha_cedo' | 'manha' | 'tarde' | 'noite' | 'madrugada';

interface RespostasWizard {
  objetivoPrincipal: string;
  estiloTrabalho: EstiloTrabalho | '';
  tempoProdutivo: TempoProdutivo[];
  procrastinacao: string;
  versao: 1;
}

const respostasIniciais: RespostasWizard = {
  objetivoPrincipal: '',
  estiloTrabalho: '',
  tempoProdutivo: [],
  procrastinacao: '',
  versao: 1,
};

// ─── dados estáticos ──────────────────────────────────────────────────────────

const estilos: Array<{ id: EstiloTrabalho; titulo: string; descricao: string }> = [
  {
    id: 'foco_profundo',
    titulo: 'Foco profundo',
    descricao: 'Prefiro blocos longos de 1 coisa',
  },
  {
    id: 'variedade',
    titulo: 'Variedade',
    descricao: 'Gosto de alternar entre contextos',
  },
  {
    id: 'reativo',
    titulo: 'Reativo',
    descricao: 'Respondo ao que aparece no dia',
  },
];

const faixasHorarias: Array<{ id: TempoProdutivo; rotulo: string; detalhe: string }> = [
  { id: 'manha_cedo', rotulo: 'Manhã cedo', detalhe: '6–9h' },
  { id: 'manha', rotulo: 'Manhã', detalhe: '9–12h' },
  { id: 'tarde', rotulo: 'Tarde', detalhe: '13–17h' },
  { id: 'noite', rotulo: 'Noite', detalhe: '17–21h' },
  { id: 'madrugada', rotulo: 'Madrugada', detalhe: '21h+' },
];

// ─── animações ────────────────────────────────────────────────────────────────

const variantesSlide = {
  enter: (dir: number) => ({
    x: dir > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
  }),
};

const transicao = { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] as number[] };

// ─── componentes auxiliares ───────────────────────────────────────────────────

function MensagemErro({ msg }: { msg: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 text-sm text-[var(--danger)]"
      role="alert"
    >
      {msg}
    </motion.p>
  );
}

// ─── tela de "já calibrado" ───────────────────────────────────────────────────

function TelaJaCalibrado({
  concluidaEm,
  onRefazer,
}: {
  concluidaEm: string;
  onRefazer: () => void;
}) {
  const router = useRouter();
  const data = new Date(concluidaEm).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <CheckCircle2 size={56} className="text-[var(--jade-accent)]" />
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Já calibrado!</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Concluído em {data}</p>
      </div>
      <p className="max-w-xs text-sm text-[var(--text-secondary)]">
        Seus critérios de sucesso já foram registrados. Você pode refazer a qualquer momento.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={() => router.push('/cards')}
          className="h-11 rounded-xl bg-[var(--jade-primary)] text-[var(--text-primary)] font-medium hover:bg-[var(--jade-accent)] transition-colors"
        >
          Ir para as tarefas
        </button>
        <button
          type="button"
          onClick={onRefazer}
          className="flex items-center justify-center gap-2 h-11 rounded-xl border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm"
        >
          <RefreshCw size={15} />
          Refazer calibração
        </button>
      </div>
    </motion.div>
  );
}

// ─── tela de sucesso ──────────────────────────────────────────────────────────

function TelaSucesso() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <motion.div
        animate={{
          boxShadow: ['0 0 0 0 rgba(44,175,147,0.4)', '0 0 0 20px rgba(44,175,147,0)'],
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="rounded-full p-4 bg-[var(--jade-dim)]"
      >
        <CheckCircle2 size={48} className="text-[var(--jade-accent)]" />
      </motion.div>
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Calibração concluída!</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Suas preferências foram salvas. Redirecionando...
        </p>
      </div>
      {/* confetti leve */}
      {Array.from({ length: 12 }, (__, i) => i).map((i) => (
        <motion.div
          key={`confetti-${i}`}
          className="fixed rounded-full"
          style={{
            width: 8 + (i % 3) * 4,
            height: 8 + (i % 3) * 4,
            background: i % 2 === 0 ? 'var(--jade-accent)' : 'var(--warning)',
            left: `${10 + ((i * 7) % 80)}%`,
            top: `${20 + ((i * 11) % 60)}%`,
          }}
          initial={{ opacity: 0, scale: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0.5],
            y: [0, -60 - (i % 3) * 30],
            x: [(i % 2 === 0 ? -1 : 1) * (i * 8)],
          }}
          transition={{ delay: i * 0.06, duration: 1.2, ease: 'easeOut' }}
        />
      ))}
    </motion.div>
  );
}

// ─── wizard principal ─────────────────────────────────────────────────────────

export default function CalibracacaoPage() {
  const router = useRouter();
  const [passo, setPasso] = useState(0); // 0-3 = perguntas, 4 = sucesso
  const [dir, setDir] = useState(1);
  const [respostas, setRespostas] = useState<RespostasWizard>(respostasIniciais);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [concluidaEm, setConcluidaEm] = useState<string | null>(null);
  const [modoRefazer, setModoRefazer] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Verifica se já calibrou
  useEffect(() => {
    fetch('/api/calibracao')
      .then((r) => r.json())
      .then((d: { concluidaEm?: string | null }) => {
        if (d.concluidaEm) setConcluidaEm(d.concluidaEm);
      })
      .catch(console.error)
      .finally(() => setCarregando(false));
  }, []);

  // Foco automático no textarea ao mudar de passo
  useEffect(() => {
    if (passo === 0 || passo === 3) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [passo]);

  const validar = useCallback((): boolean => {
    if (passo === 0 && !respostas.objetivoPrincipal.trim()) {
      setErro('Por favor, descreva seu objetivo principal.');
      return false;
    }
    if (passo === 1 && !respostas.estiloTrabalho) {
      setErro('Escolha um estilo de trabalho para continuar.');
      return false;
    }
    if (passo === 2 && respostas.tempoProdutivo.length === 0) {
      setErro('Selecione ao menos uma faixa horária.');
      return false;
    }
    if (passo === 3 && !respostas.procrastinacao.trim()) {
      setErro('Por favor, descreva o que costuma procrastinar.');
      return false;
    }
    return true;
  }, [passo, respostas]);

  const avancar = useCallback(async () => {
    if (!validar()) return;
    setErro('');

    if (passo < 3) {
      setDir(1);
      setPasso((p) => p + 1);
      return;
    }

    // Último passo: salvar
    setSalvando(true);
    try {
      const payload = { ...respostas };
      const res = await fetch('/api/calibracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteriosSucesso: payload }),
      });

      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Erro ao salvar');
      }

      setPasso(4); // tela de sucesso
      setTimeout(() => router.push('/cards'), 2000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }, [passo, respostas, validar, router]);

  const voltar = useCallback(() => {
    if (passo === 0) return;
    setErro('');
    setDir(-1);
    setPasso((p) => p - 1);
  }, [passo]);

  // Atalhos de teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (passo === 4) return;
      const tagName = (e.target as HTMLElement)?.tagName;
      if (e.key === 'Escape') {
        e.preventDefault();
        voltar();
      }
      if (e.key === 'Enter' && tagName !== 'TEXTAREA') {
        e.preventDefault();
        void avancar();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [passo, avancar, voltar]);

  if (carregando) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--bg-deep)]">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
          className="w-8 h-8 rounded-full bg-[var(--jade-primary)]"
        />
      </div>
    );
  }

  if (concluidaEm && !modoRefazer) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--bg-deep)] px-4">
        <div className="w-full max-w-md">
          <TelaJaCalibrado concluidaEm={concluidaEm} onRefazer={() => setModoRefazer(true)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-deep)] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md lg:max-w-lg">
        {/* Cabeçalho com progresso */}
        {passo < 4 && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-[var(--jade-accent)]" />
              <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-widest">
                Calibração de IA
              </span>
            </div>
            {/* Barra de progresso */}
            <div
              className="h-1.5 w-full rounded-full bg-[var(--bg-surface)]"
              role="progressbar"
              tabIndex={-1}
              aria-valuenow={passo + 1}
              aria-valuemin={1}
              aria-valuemax={4}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--grad-jade)' }}
                initial={{ width: `${(passo / 4) * 100}%` }}
                animate={{ width: `${((passo + 1) / 4) * 100}%` }}
                transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Passo {passo + 1} de 4</p>
          </motion.div>
        )}

        {/* Conteúdo animado */}
        <div className="relative overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl min-h-[340px] flex flex-col">
          <AnimatePresence custom={dir} mode="wait">
            {passo === 4 ? (
              <motion.div key="sucesso" className="flex-1 flex items-center justify-center p-8">
                <TelaSucesso />
              </motion.div>
            ) : (
              <motion.div
                key={passo}
                custom={dir}
                variants={variantesSlide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={transicao}
                className="flex-1 flex flex-col p-6 sm:p-8"
              >
                {/* Pergunta 1 — Objetivo principal */}
                {passo === 0 && (
                  <div className="flex flex-col gap-4 flex-1">
                    <label
                      htmlFor="objetivo"
                      className="text-lg font-semibold text-[var(--text-primary)] leading-snug"
                      aria-current="step"
                    >
                      Qual é o seu objetivo principal?
                    </label>
                    <p className="text-sm text-[var(--text-secondary)]">
                      O que define sucesso pra você nos próximos 3 meses?
                    </p>
                    <textarea
                      ref={textareaRef}
                      id="objetivo"
                      value={respostas.objetivoPrincipal}
                      onChange={(e) => {
                        setRespostas((r) => ({ ...r, objetivoPrincipal: e.target.value }));
                        if (erro) setErro('');
                      }}
                      placeholder="O que define sucesso pra você nos próximos 3 meses?"
                      rows={5}
                      className="flex-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--jade-accent)] transition-shadow"
                    />
                    {erro && <MensagemErro msg={erro} />}
                  </div>
                )}

                {/* Pergunta 2 — Estilo de trabalho */}
                {passo === 1 && (
                  <div className="flex flex-col gap-4 flex-1">
                    <fieldset>
                      <legend
                        className="text-lg font-semibold text-[var(--text-primary)] leading-snug mb-1"
                        aria-current="step"
                      >
                        Qual é o seu estilo de trabalho?
                      </legend>
                      <p className="text-sm text-[var(--text-secondary)] mb-4">
                        Escolha o que mais combina com você.
                      </p>
                      <div className="flex flex-col gap-3">
                        {estilos.map((e) => {
                          const ativo = respostas.estiloTrabalho === e.id;
                          return (
                            <label
                              key={e.id}
                              htmlFor={`estilo-${e.id}`}
                              className={`
                                flex items-start gap-3 p-4 rounded-xl border cursor-pointer
                                transition-all duration-200
                                ${
                                  ativo
                                    ? 'border-[var(--jade-accent)] bg-[var(--jade-dim)] text-[var(--text-primary)]'
                                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                                }
                              `}
                            >
                              <input
                                type="radio"
                                id={`estilo-${e.id}`}
                                name="estiloTrabalho"
                                value={e.id}
                                checked={ativo}
                                onChange={() => {
                                  setRespostas((r) => ({ ...r, estiloTrabalho: e.id }));
                                  if (erro) setErro('');
                                }}
                                className="sr-only"
                              />
                              <div
                                className={`
                                  mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0
                                  ${
                                    ativo
                                      ? 'border-[var(--jade-accent)] bg-[var(--jade-accent)]'
                                      : 'border-[var(--border-strong)]'
                                  }
                                `}
                              />
                              <div>
                                <p className="font-medium text-sm">{e.titulo}</p>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                  {e.descricao}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    {erro && <MensagemErro msg={erro} />}
                  </div>
                )}

                {/* Pergunta 3 — Tempo produtivo */}
                {passo === 2 && (
                  <div className="flex flex-col gap-4 flex-1">
                    <fieldset>
                      <legend
                        className="text-lg font-semibold text-[var(--text-primary)] leading-snug mb-1"
                        aria-current="step"
                      >
                        Quando você é mais produtivo?
                      </legend>
                      <p className="text-sm text-[var(--text-secondary)] mb-4">
                        Selecione todas as faixas que se aplicam.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {faixasHorarias.map((f) => {
                          const ativo = respostas.tempoProdutivo.includes(f.id);
                          return (
                            <label
                              key={f.id}
                              htmlFor={`tempo-${f.id}`}
                              className={`
                                flex items-center gap-1.5 px-4 py-2 rounded-full cursor-pointer
                                border text-sm font-medium transition-all duration-200 select-none
                                ${
                                  ativo
                                    ? 'border-[var(--jade-accent)] bg-[var(--jade-dim)] text-[var(--jade-accent)]'
                                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                                }
                              `}
                            >
                              <input
                                type="checkbox"
                                id={`tempo-${f.id}`}
                                checked={ativo}
                                onChange={() => {
                                  setRespostas((r) => ({
                                    ...r,
                                    tempoProdutivo: ativo
                                      ? r.tempoProdutivo.filter((t) => t !== f.id)
                                      : [...r.tempoProdutivo, f.id],
                                  }));
                                  if (erro) setErro('');
                                }}
                                className="sr-only"
                              />
                              <span>{f.rotulo}</span>
                              <span className="text-xs opacity-60">{f.detalhe}</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    {erro && <MensagemErro msg={erro} />}
                  </div>
                )}

                {/* Pergunta 4 — Procrastinação */}
                {passo === 3 && (
                  <div className="flex flex-col gap-4 flex-1">
                    <label
                      htmlFor="procrastinacao"
                      className="text-lg font-semibold text-[var(--text-primary)] leading-snug"
                      aria-current="step"
                    >
                      O que você costuma procrastinar?
                    </label>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Que tipo de tarefa costuma ficar pra depois?
                    </p>
                    <textarea
                      ref={textareaRef}
                      id="procrastinacao"
                      value={respostas.procrastinacao}
                      onChange={(e) => {
                        setRespostas((r) => ({ ...r, procrastinacao: e.target.value }));
                        if (erro) setErro('');
                      }}
                      placeholder="Que tipo de tarefa costuma ficar pra depois?"
                      rows={5}
                      className="flex-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--jade-accent)] transition-shadow"
                    />
                    {erro && <MensagemErro msg={erro} />}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botões de navegação */}
          {passo < 4 && (
            <div className="flex items-center justify-between px-6 pb-6 pt-2 gap-3">
              <button
                type="button"
                onClick={voltar}
                disabled={passo === 0}
                aria-label="Voltar para o passo anterior"
                className={`
                  flex items-center gap-1.5 px-4 h-10 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${
                    passo === 0
                      ? 'opacity-0 pointer-events-none'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }
                `}
              >
                <ArrowLeft size={16} />
                Voltar
              </button>

              {passo < 3 ? (
                <button
                  type="button"
                  onClick={() => void avancar()}
                  aria-label="Avançar para o próximo passo"
                  className="flex items-center gap-1.5 px-5 h-10 rounded-xl text-sm font-medium
                    bg-[var(--jade-primary)] text-[var(--text-primary)]
                    hover:bg-[var(--jade-accent)] transition-colors active:scale-95"
                >
                  Próximo
                  <ArrowRight size={16} />
                </button>
              ) : (
                <motion.button
                  onClick={() => void avancar()}
                  disabled={salvando}
                  aria-label="Concluir calibração"
                  animate={
                    salvando
                      ? {}
                      : {
                          boxShadow: [
                            '0 0 0 0 rgba(44,175,147,0.4)',
                            '0 0 0 8px rgba(44,175,147,0)',
                          ],
                        }
                  }
                  transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
                  className="flex items-center gap-1.5 px-5 h-10 rounded-xl text-sm font-medium
                    bg-[var(--jade-primary)] text-[var(--text-primary)]
                    hover:bg-[var(--jade-accent)] transition-colors active:scale-95
                    disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {salvando ? 'Salvando...' : 'Concluir'}
                  <CheckCircle2 size={16} />
                </motion.button>
              )}
            </div>
          )}
        </div>

        {/* Indicadores de passo (dots) */}
        {passo < 4 && (
          <div className="flex justify-center gap-2 mt-5">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{
                  width: i === passo ? 24 : 8,
                  backgroundColor: i === passo ? 'var(--jade-accent)' : 'var(--bg-hover)',
                }}
                transition={{ duration: 0.25 }}
                className="h-2 rounded-full"
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
