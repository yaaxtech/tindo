'use client';

import { cn } from '@/lib/utils';
import type { AreaV2, AtencaoV2, DegrauV2, EstadoAreaV2, HarnessV2 } from '@/types/harness';
import { useState } from 'react';
import { fmtData, fmtDuracao, fmtInt, fmtNota, fmtPct, fmtTokens } from './formato';

// ── Peças visuais ───────────────────────────────────────────────────────────

function Secao({
  id,
  titulo,
  sub,
  children,
}: { id: string; titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="space-y-3">
      <div>
        <h2 id={`${id}-t`} className="text-base font-semibold text-text-primary">
          {titulo}
        </h2>
        {sub && <p className="text-sm text-text-muted">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Cartao({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-border bg-bg-elevated p-4', className)}>
      {children}
    </div>
  );
}

/** Tabela larga rola dentro do próprio container — a página nunca rola de lado. */
function Rolavel({ children, rotulo }: { children: React.ReactNode; rotulo: string }) {
  return (
    <section
      aria-label={rotulo}
      className="max-w-full overflow-x-auto rounded-xl border border-border bg-bg-elevated"
    >
      {children}
    </section>
  );
}

const NOME_PROVEDOR: Record<string, string> = { claude: 'Claude', codex: 'ChatGPT' };

function Degrau({ d }: { d: DegrauV2 | null }) {
  if (!d) return <span className="text-text-muted">—</span>;
  const claude = d.provedor === 'claude';
  return (
    <span
      title={`${NOME_PROVEDOR[d.provedor] ?? d.provedor} · ${d.modelo} / ${d.effort}`}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium',
        claude ? 'bg-jade/15 text-jade-accent' : 'bg-info/15 text-info',
      )}
    >
      <span
        aria-hidden
        className={cn('h-1.5 w-1.5 rounded-full', claude ? 'bg-jade-accent' : 'bg-info')}
      />
      {d.rotulo}
    </span>
  );
}

export const ESTADOS: Record<EstadoAreaV2, { icone: string; texto: string; cor: string }> = {
  comprovado_mais_barato: {
    icone: '✅',
    texto: 'Comprovado',
    cor: 'bg-success/15 text-success',
  },
  passa: { icone: '✅', texto: 'Passa', cor: 'bg-success/15 text-success' },
  testando_mais_barato: {
    icone: '🔬',
    texto: 'Testando mais barato',
    cor: 'bg-jade/15 text-jade-accent',
  },
  quer_subir: { icone: '⬆', texto: 'Quer subir', cor: 'bg-warning/15 text-warning' },
  falhando: { icone: '⚠', texto: 'Falhando', cor: 'bg-danger/15 text-danger' },
  juntando_dado: { icone: '⏳', texto: 'Juntando dado', cor: 'bg-bg-surface text-text-secondary' },
  sem_confianca: { icone: '⚪', texto: 'Sem confiança', cor: 'bg-bg-surface text-text-muted' },
};

function ChipEstado({ estado }: { estado: EstadoAreaV2 }) {
  const e = ESTADOS[estado] ?? ESTADOS.sem_confianca;
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        e.cor,
      )}
    >
      <span aria-hidden className="mr-1">
        {e.icone}
      </span>
      {e.texto}
    </span>
  );
}

function Barra({
  valor,
  max = 100,
  cor = 'bg-jade',
}: { valor: number | null; max?: number; cor?: string }) {
  const pct = valor == null ? 0 : Math.max(0, Math.min(100, (100 * valor) / max));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-bg-surface">
      <div className={cn('h-full rounded-full', cor)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Respostas do dono ───────────────────────────────────────────────────────

/** Como a página conversa com o dono. Sem isto, as propostas mostram só o status. */
export interface RespostasDonoProps {
  /** Dono logado: vê os botões. */
  dono: boolean;
  /** Respostas já gravadas, por id da proposta. */
  respostas: Record<string, -1 | 1>;
  responder: (alvoId: string, valor: -1 | 1) => Promise<{ ok: true } | { ok: false; erro: string }>;
}

const TEXTO_RESPOSTA = {
  1: 'Aprovado — aplica na próxima hora.',
  [-1]: 'Recusado — nada muda.',
} as const;

function RespostaProposta({ a, r }: { a: AtencaoV2; r?: RespostasDonoProps }) {
  const [pedindo, setPedindo] = useState<-1 | 1 | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [local, setLocal] = useState<-1 | 1 | null>(null);
  const valor = local ?? r?.respostas[a.id] ?? null;

  if (valor != null) {
    return (
      <p
        data-testid={`resposta-${a.id}`}
        className={cn(
          'mt-2 text-sm font-medium',
          valor === 1 ? 'text-success' : 'text-text-secondary',
        )}
      >
        {TEXTO_RESPOSTA[valor]}
      </p>
    );
  }
  if (!r?.dono) {
    return <p className="mt-2 text-sm text-text-muted">Aguardando o dono decidir.</p>;
  }
  const confirmar = async () => {
    if (pedindo == null) return;
    setSalvando(true);
    setErro(null);
    const res = await r.responder(a.id, pedindo);
    setSalvando(false);
    if (res.ok) setLocal(pedindo);
    else setErro(res.erro);
  };
  const botao = 'rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50';
  if (pedindo != null) {
    return (
      <div className="mt-2 space-y-2" data-testid={`confirmar-${a.id}`}>
        <p className="text-sm text-text-primary">
          {pedindo === 1 ? 'Confirmar aprovação?' : 'Confirmar recusa?'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={salvando}
            onClick={confirmar}
            className={cn(botao, 'bg-jade text-text-inverse hover:bg-jade/90')}
          >
            {salvando ? 'Salvando…' : pedindo === 1 ? 'Sim, aprovar' : 'Sim, recusar'}
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => setPedindo(null)}
            className={cn(botao, 'border border-border text-text-secondary hover:bg-bg-hover')}
          >
            Voltar
          </button>
        </div>
        {erro && (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setPedindo(1)}
        className={cn(botao, 'bg-jade text-text-inverse hover:bg-jade/90')}
      >
        Aprovar
      </button>
      <button
        type="button"
        onClick={() => setPedindo(-1)}
        className={cn(botao, 'border border-border text-text-secondary hover:bg-bg-hover')}
      >
        Recusar
      </button>
    </div>
  );
}

// ── Blocos ──────────────────────────────────────────────────────────────────

const PILARES = [
  { chave: 'qualidade', nome: 'Qualidade', ajuda: 'Acerto de primeira contra a meta.' },
  { chave: 'economia', nome: 'Economia', ajuda: 'Áreas no degrau mais barato que passa.' },
  { chave: 'confianca', nome: 'Confiança', ajuda: 'Tarefas com todos os dados medidos.' },
] as const;

function Nota({ s }: { s: HarnessV2 }) {
  const { nota } = s;
  const hist = nota.historico.slice(-8);
  const bateu = nota.valor != null && nota.valor >= nota.meta;
  return (
    <Secao
      id="nota"
      titulo="Nota da semana"
      sub="Custo × benefício, de 0 a 100. É a média dos 3 pilares."
    >
      <Cartao className="grid gap-4 md:grid-cols-[auto_1fr_1fr]">
        <div>
          <p
            data-testid="nota-valor"
            className={cn(
              'text-5xl font-bold tabular-nums',
              bateu ? 'text-success' : 'text-warning',
            )}
          >
            {fmtNota(nota.valor)}
          </p>
          <p className="text-sm text-text-muted">meta {fmtNota(nota.meta)}</p>
        </div>
        <ul className="space-y-2">
          {PILARES.map((p) => (
            <li key={p.chave}>
              <div className="flex justify-between text-sm">
                <span className="text-text-primary">{p.nome}</span>
                <span className="tabular-nums text-text-secondary">{fmtPct(nota[p.chave])}</span>
              </div>
              <Barra valor={nota[p.chave]} />
              <p className="text-xs text-text-muted">{p.ajuda}</p>
            </li>
          ))}
        </ul>
        <div>
          <p className="mb-2 text-sm text-text-secondary">Últimas {hist.length} semanas</p>
          <div className="flex h-24 items-end gap-1" aria-label="Tendência da nota">
            {hist.map((h) => (
              <div key={h.semana} className="flex flex-1 flex-col items-center gap-1">
                <div
                  title={`${h.semana}: ${fmtNota(h.valor)}`}
                  className="w-full rounded-t bg-jade/60"
                  style={{ height: `${h.valor == null ? 2 : Math.max(2, h.valor * 0.8)}px` }}
                />
                <span className="text-[10px] tabular-nums text-text-muted">
                  {h.semana.split('-W')[1] ?? h.semana}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-text-muted">Número da semana do ano embaixo.</p>
        </div>
      </Cartao>
    </Secao>
  );
}

function Atencao({ s, r }: { s: HarnessV2; r?: RespostasDonoProps }) {
  const itens = s.atencao.slice(0, 3);
  return (
    <Secao id="atencao" titulo="Precisa de você">
      {itens.length === 0 ? (
        <Cartao>
          <p data-testid="atencao-vazia" className="text-success">
            Nada precisa de você agora. Tudo rodando sozinho.
          </p>
        </Cartao>
      ) : (
        <ul className="space-y-2">
          {itens.map((a) => (
            <li key={a.id}>
              <Cartao className="border-warning/40">
                <p className="font-medium text-text-primary">
                  <span className="mr-2 text-xs text-text-muted">{a.id}</span>
                  {a.titulo}
                </p>
                <p className="text-sm text-text-secondary">{a.detalhe}</p>
                {a.tipo === 'proposta_subir' ? (
                  <RespostaProposta a={a} r={r} />
                ) : (
                  <p className="mt-1 text-sm font-medium text-jade-accent">{a.acao}</p>
                )}
              </Cartao>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

function Mapa({ areas }: { areas: AreaV2[] }) {
  return (
    <Secao
      id="mapa"
      titulo="Mapa por área"
      sub="Quem faz cada tipo de trabalho. Certo de primeira = entregue sem retrabalho."
    >
      <div className="flex flex-wrap gap-3 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-jade-accent" /> Claude
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-info" /> ChatGPT
        </span>
      </div>
      <Rolavel rotulo="Tabela do mapa por área">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-text-muted">
            <tr className="border-b border-border">
              <th className="p-2 font-medium">Área</th>
              <th className="p-2 font-medium">Estado</th>
              <th className="p-2 font-medium">Quem faz</th>
              <th className="p-2 font-medium">Reserva (outra assinatura)</th>
              <th className="p-2 font-medium">Teto</th>
              <th className="p-2 text-right font-medium">Certo de primeira</th>
              <th className="p-2 text-right font-medium">Tarefas</th>
              <th className="p-2 text-right font-medium">Custo (tokens de saída)</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr
                key={a.id}
                data-testid={`area-${a.id}`}
                className="border-b border-border last:border-0"
              >
                <td className="p-2">
                  <p className="font-medium text-text-primary">
                    {a.nome}
                    {a.risco && <span className="ml-1 text-xs text-warning">risco</span>}
                  </p>
                  <p className="text-xs text-text-muted">{a.descricao}</p>
                </td>
                <td className="p-2">
                  <ChipEstado estado={a.estado} />
                </td>
                <td className="p-2">
                  <Degrau d={a.titular} />
                </td>
                <td className="p-2">
                  <Degrau d={a.fallback} />
                </td>
                <td className="p-2">
                  <Degrau d={a.teto} />
                </td>
                <td className="p-2 text-right tabular-nums">
                  <span
                    className={cn(
                      a.ok1 == null
                        ? 'text-text-muted'
                        : a.ok1 >= a.meta_ok1
                          ? 'text-success'
                          : 'text-danger',
                    )}
                  >
                    {fmtPct(a.ok1)}
                  </span>
                  <span className="block text-xs text-text-muted">meta {fmtPct(a.meta_ok1)}</span>
                </td>
                <td className="p-2 text-right tabular-nums text-text-secondary">
                  {fmtInt(a.n)}
                  <span className="block text-xs text-text-muted">
                    {fmtInt(a.julgados)} julgadas
                  </span>
                </td>
                <td className="p-2 text-right tabular-nums text-text-secondary">
                  {fmtTokens(a.tokens_saida_mediana)}
                  <span className="block text-xs text-text-muted">
                    {fmtDuracao(a.duracao_mediana_s)} por tarefa
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Rolavel>
    </Secao>
  );
}

function Testes({ s }: { s: HarnessV2 }) {
  const nomeArea = (id: string) => s.areas.find((a) => a.id === id)?.nome ?? id;
  return (
    <Secao
      id="testes"
      titulo="Testes em andamento"
      sub="O mais barato só vence com 20 tarefas em cada lado."
    >
      {s.testes.length === 0 ? (
        <Cartao>
          <p className="text-sm text-text-muted">Nenhum teste rodando agora.</p>
        </Cartao>
      ) : (
        s.testes.map((t) => (
          <Cartao key={t.id} className="space-y-3">
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">{nomeArea(t.area)}</span> · {t.id} ·
              desde {fmtData(t.desde)}
            </p>
            {t.bracos.map((b) => (
              <div key={b.rotulo} className="space-y-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="text-text-primary">{b.rotulo}</span>
                  <span className="tabular-nums text-text-secondary">
                    {fmtInt(b.n)}/{fmtInt(b.meta_n)} · certo de primeira {fmtPct(b.ok1)}
                  </span>
                </div>
                <Barra valor={b.n} max={b.meta_n || 20} />
              </div>
            ))}
          </Cartao>
        ))
      )}
    </Secao>
  );
}

const NOME_ASSINATURA: Record<string, string> = {
  claude_max_5x: 'Claude Max 5x',
  chatgpt_pro_20x: 'ChatGPT Pro 20x',
};

function Assinaturas({ s }: { s: HarnessV2 }) {
  return (
    <Secao id="assinaturas" titulo="Assinaturas" sub={`Últimos ${s.periodo.dias} dias.`}>
      <div className="grid gap-3 md:grid-cols-2">
        {s.assinaturas.map((a) => (
          <Cartao key={a.id}>
            <p className="font-medium text-text-primary">{NOME_ASSINATURA[a.id] ?? a.id}</p>
            <p className="mb-3 break-all text-xs text-text-muted">{a.conta || '—'}</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-text-muted">Tarefas</dt>
              <dd className="text-right tabular-nums">{fmtInt(a.tarefas)}</dd>
              <dt className="text-text-muted">Tokens de saída</dt>
              <dd className="text-right tabular-nums">{fmtTokens(a.tokens_saida)}</dd>
              <dt className="text-text-muted">Bateu no limite</dt>
              <dd className="text-right tabular-nums">{fmtInt(a.quota_bateu)}×</dd>
              <dt className="text-text-muted">Usou a reserva</dt>
              <dd className="text-right tabular-nums">{fmtInt(a.fallback_acionado)}×</dd>
            </dl>
          </Cartao>
        ))}
      </div>
    </Secao>
  );
}

function Aderencia({ s }: { s: HarnessV2 }) {
  return (
    <Secao
      id="aderencia"
      titulo="Aderência por conta"
      sub="Quantas sessões usaram o modelo que a rota mandava."
    >
      <Cartao className="space-y-3">
        {s.aderencia.length === 0 && (
          <p className="text-sm text-text-muted">Sem sessões medidas.</p>
        )}
        {s.aderencia.map((a) => (
          <div key={a.conta} className="space-y-1">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="break-all text-text-primary">
                {a.conta}{' '}
                <span className="text-text-muted">({NOME_PROVEDOR[a.provedor] ?? a.provedor})</span>
              </span>
              <span className="tabular-nums text-text-secondary">
                {fmtPct(a.pct)} · {fmtInt(a.na_rota)} de {fmtInt(a.sessoes)}
              </span>
            </div>
            <Barra valor={a.pct} />
          </div>
        ))}
      </Cartao>
    </Secao>
  );
}

const TIPO_DECISAO: Record<string, string> = {
  teste_aberto: 'Teste aberto',
  teste_fechado: 'Teste fechado',
  barateou: 'Barateou',
  voltou: 'Voltou',
  subiu: 'Subiu',
  proposta: 'Proposta',
  sem_decisao: 'Sem decisão',
};

function Diario({ s }: { s: HarnessV2 }) {
  const nomeArea = (id: string) => s.areas.find((a) => a.id === id)?.nome ?? id;
  return (
    <Secao id="diario" titulo="Diário de decisões" sub="O que o motor mudou sozinho ou propôs.">
      <Cartao>
        {s.decisoes.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma decisão no período.</p>
        ) : (
          <ol className="space-y-3">
            {s.decisoes.map((d) => (
              <li key={`${d.em}-${d.area}-${d.tipo}`} className="text-sm">
                <p className="text-text-primary">
                  <span className="mr-2 text-xs tabular-nums text-text-muted">{fmtData(d.em)}</span>
                  <span className="font-medium">{TIPO_DECISAO[d.tipo] ?? d.tipo}</span> ·{' '}
                  {nomeArea(d.area)}
                  {d.de && d.para && (
                    <span className="text-text-secondary">
                      {' '}
                      — {d.de} → {d.para}
                    </span>
                  )}
                </p>
                <p className="text-text-muted">{d.motivo}</p>
              </li>
            ))}
          </ol>
        )}
      </Cartao>
    </Secao>
  );
}

const CAMPOS = [
  ['modelo', 'Modelo'],
  ['effort', 'Esforço (effort)'],
  ['tokens', 'Tokens'],
  ['duracao', 'Duração'],
  ['area_declarada', 'Área declarada'],
  ['veredito', 'Veredito'],
] as const;

function Saude({ s }: { s: HarnessV2 }) {
  const fontes = Object.keys(s.saude.por_fonte);
  return (
    <Secao
      id="saude"
      titulo="Saúde da medição"
      sub={`% das tarefas com cada dado registrado. Última coleta: ${fmtData(s.saude.ultima_coleta)}.`}
    >
      <Rolavel rotulo="Cobertura por campo e por fonte">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-xs text-text-muted">
            <tr className="border-b border-border">
              <th className="p-2 text-left font-medium">Dado</th>
              <th className="p-2 text-right font-medium">Geral</th>
              {fontes.map((f) => (
                <th key={f} className="p-2 text-right font-medium">
                  {NOME_PROVEDOR[f] ?? f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAMPOS.map(([k, nome]) => (
              <tr key={k} className="border-b border-border last:border-0">
                <td className="p-2 text-text-primary">{nome}</td>
                <td className="p-2 text-right tabular-nums">{fmtPct(s.saude.cobertura[k])}</td>
                {fontes.map((f) => (
                  <td key={f} className="p-2 text-right tabular-nums text-text-secondary">
                    {fmtPct(s.saude.por_fonte[f]?.[k] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Rolavel>
      <Cartao>
        <p className="mb-2 text-sm font-medium text-text-primary">Erros da coleta</p>
        {s.saude.erros.length === 0 ? (
          <p className="text-sm text-success">Nenhum erro.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {s.saude.erros.map((e) => (
              <li key={`${e.em}-${e.onde}`}>
                <p className="break-all font-mono text-xs text-text-muted">
                  {fmtData(e.em)} · {e.onde}
                </p>
                <p className="text-danger">{e.msg}</p>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </Secao>
  );
}

function ParaIAs({ s }: { s: HarnessV2 }) {
  const [copiado, setCopiado] = useState(false);
  const json = JSON.stringify(s, null, 2);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <Secao id="para-ias" titulo="Para IAs" sub="O snapshot completo, sem resumo.">
      <Cartao className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copiar}
            className="rounded-lg bg-jade px-3 py-1.5 text-sm font-medium text-text-inverse hover:bg-jade/90"
          >
            {copiado ? 'Copiado' : 'Copiar JSON'}
          </button>
          <a
            href="/harness.json"
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-jade-accent hover:bg-bg-hover"
          >
            Abrir /harness.json
          </a>
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-text-secondary">Ver JSON</summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-bg-deep p-3 text-xs text-text-secondary">
            {json}
          </pre>
        </details>
      </Cartao>
    </Secao>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

export function PainelV2({ s, respostas }: { s: HarnessV2; respostas?: RespostasDonoProps }) {
  return (
    <div className="space-y-8">
      <Nota s={s} />
      <Atencao s={s} r={respostas} />
      <Mapa areas={s.areas} />
      <Testes s={s} />
      <Assinaturas s={s} />
      <Aderencia s={s} />
      <Diario s={s} />
      <Saude s={s} />
      <ParaIAs s={s} />
    </div>
  );
}

export function ehSnapshotV2(x: unknown): x is HarnessV2 {
  return typeof x === 'object' && x !== null && (x as { versao?: unknown }).versao === 2;
}
