'use client';

import {
  type CamposTriagem,
  type Prioridade,
  type TipoItem,
  camposAlterados,
} from '@/lib/triagem/comentario';
import type { ItemRevisao, PainelRevisao } from '@/services/triagem-revisao';
import { Check, CheckCircle2, Info, Merge, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ModalExcluir, ModalMesclar } from './Modais';

const PRIORIDADES: Prioridade[] = ['P1', 'P2', 'P3', 'P4'];

const NOME_CAMPO: Record<string, string> = {
  tipo: 'tipo',
  projetoId: 'projeto',
  etiquetas: 'etiquetas',
  prioridade: 'prioridade',
  quando: 'quando',
  delegar: 'delegar',
};

const campoCls =
  'h-9 w-full rounded-md border border-border-strong bg-bg-deep px-2 text-sm text-text-primary focus:border-jade-accent focus:outline-none';

function camposDe(item: ItemRevisao): CamposTriagem {
  const base = item.revisao ?? item.sugestao;
  return {
    tipo: base.tipo,
    projetoId: base.projetoId,
    etiquetas: [...base.etiquetas],
    prioridade: base.prioridade,
    quando: base.quando,
    delegar: base.delegar,
  };
}

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dataHora.format(d);
}

/** Detalhes da tarefa ao passar o mouse (ou tocar no ícone, no celular). */
function Detalhes({ item }: { item: ItemRevisao }) {
  const [aberto, setAberto] = useState(false);
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label="Detalhes da tarefa"
        onClick={() => setAberto((v) => !v)}
        onBlur={() => setAberto(false)}
        className="ml-1 text-text-muted hover:text-jade-accent"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className={`${aberto ? 'block' : 'hidden'} absolute left-0 top-6 z-40 w-72 rounded-lg border border-border-strong bg-bg-deep p-3 text-xs text-text-secondary shadow-xl group-hover:block`}
      >
        <span className="block font-medium text-text-primary">{item.conteudo}</span>
        {item.descricao && (
          <span className="mt-1 block whitespace-pre-line text-text-muted">{item.descricao}</span>
        )}
        <span className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <span className="text-text-muted">Projeto</span>
          <span>{item.projetoAtual}</span>
          <span className="text-text-muted">Data</span>
          <span>
            {item.vencimentoTexto ?? formatarData(item.vencimento)}
            {item.recorrente ? ' (recorrente)' : ''}
          </span>
          <span className="text-text-muted">Criada em</span>
          <span>{formatarData(item.criadaEm)}</span>
          <span className="text-text-muted">Criada por</span>
          <span>{item.criadaPor ?? 'não sei'}</span>
        </span>
      </span>
    </span>
  );
}

export type AcaoCartao = 'concluir' | 'reabrir' | 'excluir' | 'mesclar';

function lerEtiquetas(texto: string): string[] {
  return texto
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

function CartaoItem({
  item,
  painel,
  aoSalvar,
  aoAcao,
  concluida,
}: {
  item: ItemRevisao;
  painel: PainelRevisao;
  aoAcao: (acao: AcaoCartao, item: ItemRevisao) => void;
  concluida: boolean;
  aoSalvar: (tarefaId: string, campos: CamposTriagem, nota: string) => Promise<void>;
}) {
  const [campos, setCampos] = useState<CamposTriagem>(() => camposDe(item));
  const [etiquetasTexto, setEtiquetasTexto] = useState(() => camposDe(item).etiquetas.join(', '));
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(item.revisao === null);

  const finais: CamposTriagem = { ...campos, etiquetas: lerEtiquetas(etiquetasTexto) };
  const mudou = camposAlterados(item.sugestao, finais);
  const nomeProjeto = (id: string | null) =>
    id ? (painel.projetos.find((p) => p.id === id)?.nome ?? 'projeto') : 'Fica na Entrada';

  function mudarProjeto(valor: string) {
    const projetoId = valor || null;
    // Regra do dono: item que sai da Entrada para um projeto fica delegado a ele.
    setCampos((c) => ({ ...c, projetoId, delegar: projetoId ? true : c.delegar }));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await aoSalvar(item.tarefaId, finais, nota);
      setNota('');
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar agora.');
    } finally {
      setSalvando(false);
    }
  }

  const s = item.sugestao;
  const baixa = s.confianca < 0.75;

  return (
    <li className="rounded-lg border border-[#1B222C] bg-bg-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={
              concluida
                ? 'font-medium text-text-muted line-through'
                : 'font-medium text-text-primary'
            }
          >
            {item.conteudo}
            <Detalhes item={item} />
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            Criada {formatarData(item.criadaEm)}
            {item.criadaPor ? ` por ${item.criadaPor}` : ''} · {item.projetoAtual}
          </p>
          {item.descricao && (
            <p className="mt-1 line-clamp-2 text-xs text-text-muted">{item.descricao}</p>
          )}
        </div>
        {item.revisao ? (
          <span className="shrink-0 rounded bg-[#198B74]/15 px-2 py-0.5 text-xs text-[#2CAF93]">
            {item.revisao.status === 'aprovado' ? 'Aprovado' : 'Corrigido'}
          </span>
        ) : (
          <span
            className={
              baixa
                ? 'shrink-0 rounded bg-[#F2B94B]/15 px-2 py-0.5 text-xs text-[#F2B94B]'
                : 'shrink-0 rounded bg-[#1B222C] px-2 py-0.5 text-xs text-text-secondary'
            }
          >
            {Math.round(s.confianca * 100)}% de certeza
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-text-secondary">
        <span className="text-text-muted">Vigia: </span>
        {s.porque}
      </p>
      {s.alerta && <p className="mt-1 text-xs text-[#F2B94B]">{s.alerta}</p>}

      {!editando && item.revisao ? (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-text-secondary">
          <span>
            {item.revisao.tipo === 'lembrete' ? 'Lembrete' : 'Tarefa'} ·{' '}
            {nomeProjeto(item.revisao.projetoId)} · {item.revisao.prioridade}
            {item.revisao.quando ? ` · ${item.revisao.quando}` : ''}
          </span>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="shrink-0 text-xs text-text-muted hover:text-jade-accent"
          >
            Revisar de novo
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-text-muted">
              Tipo
              <select
                className={campoCls}
                value={campos.tipo}
                onChange={(e) => setCampos((c) => ({ ...c, tipo: e.target.value as TipoItem }))}
              >
                <option value="lembrete">Lembrete (até 2 min)</option>
                <option value="tarefa">Tarefa</option>
              </select>
            </label>
            <label className="text-xs text-text-muted">
              Projeto
              <select
                className={campoCls}
                value={campos.projetoId ?? ''}
                onChange={(e) => mudarProjeto(e.target.value)}
              >
                <option value="">Fica na Entrada</option>
                {painel.projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-text-muted">
              Prioridade
              <select
                className={campoCls}
                value={campos.prioridade}
                onChange={(e) =>
                  setCampos((c) => ({ ...c, prioridade: e.target.value as Prioridade }))
                }
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-text-muted">
              Quando
              <input
                className={campoCls}
                value={campos.quando}
                placeholder="amanhã de manhã"
                onChange={(e) => setCampos((c) => ({ ...c, quando: e.target.value }))}
              />
            </label>
            <label className="text-xs text-text-muted sm:col-span-2">
              Etiquetas (separe por vírgula)
              <input
                className={campoCls}
                value={etiquetasTexto}
                list="triagem-etiquetas"
                onChange={(e) => setEtiquetasTexto(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary sm:col-span-2">
              <input
                type="checkbox"
                checked={campos.delegar}
                onChange={(e) => setCampos((c) => ({ ...c, delegar: e.target.checked }))}
                className="h-4 w-4 accent-[#198B74]"
              />
              Delegar a mim
            </label>
            {mudou.length > 0 && (
              <label className="text-xs text-text-muted sm:col-span-2">
                Por que mudou? (opcional, ajuda o vigia a aprender)
                <input
                  className={campoCls}
                  value={nota}
                  placeholder="Aqualitas é do SeuCamarão"
                  onChange={(e) => setNota(e.target.value)}
                />
              </label>
            )}
          </div>

          <div className="mt-3 flex items-center justify-end gap-3">
            {erro && (
              <p role="alert" className="mr-auto text-xs text-danger">
                {erro}
              </p>
            )}
            {mudou.length > 0 && (
              <span className="text-xs text-text-muted">
                Mudou: {mudou.map((c) => NOME_CAMPO[c] ?? c).join(', ')}
              </span>
            )}
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
              className="flex h-9 items-center gap-2 rounded-md bg-jade px-4 text-sm font-medium text-white hover:bg-jade-accent disabled:opacity-50"
            >
              <Check size={14} aria-hidden="true" />
              {salvando ? 'Salvando…' : mudou.length > 0 ? 'Salvar correção' : 'Aprovar'}
            </button>
          </div>
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#1B222C] pt-3 text-xs">
        {concluida ? (
          <button
            type="button"
            onClick={() => aoAcao('reabrir', item)}
            className="flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 hover:border-jade-accent"
          >
            <RotateCcw size={12} aria-hidden="true" /> Concluída. Desfazer
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => aoAcao('concluir', item)}
              className="flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 hover:border-jade-accent hover:text-jade-accent"
            >
              <CheckCircle2 size={12} aria-hidden="true" /> Concluir
            </button>
            <button
              type="button"
              onClick={() => aoAcao('mesclar', item)}
              className={
                s.duplicadoDe
                  ? 'flex items-center gap-1 rounded-md border border-[#F2B94B]/60 px-2 py-1 text-[#F2B94B] hover:opacity-80'
                  : 'flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 hover:border-jade-accent'
              }
            >
              <Merge size={12} aria-hidden="true" /> Mesclar
            </button>
            <button
              type="button"
              onClick={() => aoAcao('excluir', item)}
              className="flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 hover:border-[#E3546C] hover:text-[#E3546C]"
            >
              <Trash2 size={12} aria-hidden="true" /> Excluir
            </button>
          </>
        )}
      </div>
    </li>
  );
}

export default function TriagemPage() {
  const [painel, setPainel] = useState<PainelRevisao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluidas, setConcluidas] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ tipo: 'excluir' | 'mesclar'; item: ItemRevisao } | null>(
    null,
  );
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch('/api/triagem/revisao');
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo.erro ?? 'Não consegui ler a triagem.');
      setPainel(corpo as PainelRevisao);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler a triagem.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const salvar = useCallback(async (tarefaId: string, campos: CamposTriagem, nota: string) => {
    const res = await fetch('/api/triagem/revisao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tarefaId, campos, nota }),
    });
    const corpo = await res.json();
    if (!res.ok) throw new Error(corpo.erro ?? 'Não consegui salvar agora.');
    setPainel((p) =>
      p
        ? {
            ...p,
            itens: p.itens.map((i) =>
              i.tarefaId === tarefaId ? { ...i, revisao: corpo.revisao } : i,
            ),
          }
        : p,
    );
  }, []);

  async function chamarAcao(corpo: Record<string, string>): Promise<boolean> {
    setOcupado(true);
    setAviso(null);
    try {
      const res = await fetch('/api/triagem/acao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(dados.erro ?? 'Não consegui falar com o Todoist agora.');
      return true;
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não consegui falar com o Todoist agora.');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function tirarDaLista(...ids: string[]) {
    setPainel((p) => (p ? { ...p, itens: p.itens.filter((i) => !ids.includes(i.tarefaId)) } : p));
  }

  async function aoAcao(acao: AcaoCartao, item: ItemRevisao) {
    if (acao === 'excluir' || acao === 'mesclar') {
      setModal({ tipo: acao, item });
      return;
    }
    if (await chamarAcao({ acao, tarefaId: item.tarefaId })) {
      setConcluidas((c) => {
        const n = new Set(c);
        if (acao === 'concluir') n.add(item.tarefaId);
        else n.delete(item.tarefaId);
        return n;
      });
    }
  }

  async function confirmarExcluir() {
    if (!modal) return;
    const id = modal.item.tarefaId;
    if (await chamarAcao({ acao: 'excluir', tarefaId: id })) {
      tirarDaLista(id);
      setModal(null);
    }
  }

  async function confirmarMesclar(ficaId: string, saiId: string) {
    if (await chamarAcao({ acao: 'mesclar', tarefaId: ficaId, saiId })) {
      tirarDaLista(saiId);
      setModal(null);
      setAviso('Tarefas mescladas.');
    }
  }

  const pendentes = painel?.itens.filter((i) => i.revisao === null) ?? [];
  const revisados = painel?.itens.filter((i) => i.revisao !== null) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Triagem da Entrada</h1>
          <p className="mt-1 text-sm text-text-secondary">
            O vigia sugere, você aprova ou corrige. Cada correção fica anotada no item do Todoist e
            o vigia aprende com ela na próxima rodada.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          disabled={carregando}
          className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-border-strong px-3 text-sm hover:border-jade-accent disabled:opacity-50"
        >
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} aria-hidden="true" />
          Atualizar
        </button>
      </div>

      {erro && (
        <p role="alert" className="mt-6 text-sm text-danger">
          {erro}
        </p>
      )}
      {aviso && <output className="mt-4 block text-sm text-[#F2B94B]">{aviso}</output>}
      {modal?.tipo === 'excluir' && (
        <ModalExcluir
          conteudo={modal.item.conteudo}
          ocupado={ocupado}
          onFechar={() => setModal(null)}
          onConfirmar={() => void confirmarExcluir()}
        />
      )}
      {modal?.tipo === 'mesclar' && painel && (
        <ModalMesclar
          atual={{ id: modal.item.tarefaId, conteudo: modal.item.conteudo }}
          sugerida={modal.item.sugestao.duplicadoDe ?? null}
          tarefas={painel.tarefas}
          ocupado={ocupado}
          onFechar={() => setModal(null)}
          onConfirmar={(fica, sai) => void confirmarMesclar(fica, sai)}
        />
      )}
      {carregando && !painel && (
        <p className="mt-6 text-sm text-text-muted">Lendo as sugestões no seu Todoist…</p>
      )}

      {painel && (
        <>
          <datalist id="triagem-etiquetas">
            {painel.etiquetas.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
          <p className="mt-6 text-sm text-text-muted">
            {pendentes.length} para revisar, {revisados.length} já revisados.{' '}
            {painel.semSugestao > 0 &&
              `${painel.semSugestao} itens da Entrada ainda sem sugestão do vigia.`}
          </p>
          {painel.itens.length === 0 && (
            <p className="mt-4 rounded-lg border border-[#1B222C] bg-bg-elevated p-4 text-sm text-text-secondary">
              Nenhuma sugestão do vigia ainda. Quando ele passar pela sua Entrada, os itens aparecem
              aqui para você revisar.
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {pendentes.map((i) => (
              <CartaoItem
                key={i.tarefaId}
                item={i}
                painel={painel}
                aoSalvar={salvar}
                aoAcao={aoAcao}
                concluida={concluidas.has(i.tarefaId)}
              />
            ))}
          </ul>
          {revisados.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-medium text-text-secondary">Já revisados</h2>
              <ul className="mt-3 space-y-3">
                {revisados.map((i) => (
                  <CartaoItem
                    key={i.tarefaId}
                    item={i}
                    painel={painel}
                    aoSalvar={salvar}
                    aoAcao={aoAcao}
                    concluida={concluidas.has(i.tarefaId)}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
