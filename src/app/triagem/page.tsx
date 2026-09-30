'use client';

import {
  type CamposTriagem,
  type Prioridade,
  type TipoItem,
  camposAlterados,
} from '@/lib/triagem/comentario';
import type { ItemRevisao, PainelRevisao, TarefaResumo } from '@/services/triagem-revisao';
import { Check, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { type AcaoCartao, type AlvoAcao, BarraAcoes, Detalhes, formatarData } from './Comum';
import { SecaoLembretes } from './Lembretes';
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

function CartaoSemSugestao({
  item,
  concluida,
  aoAcao,
}: {
  item: TarefaResumo;
  concluida: boolean;
  aoAcao: (acao: AcaoCartao, alvo: AlvoAcao) => void;
}) {
  return (
    <li className="rounded-lg border border-[#1B222C] bg-bg-elevated p-4">
      <p
        className={
          concluida ? 'font-medium text-text-muted line-through' : 'font-medium text-text-primary'
        }
      >
        {item.conteudo}
        <Detalhes item={item} />
      </p>
      <p className="mt-0.5 text-xs text-text-muted">
        Criada {formatarData(item.criadaEm)}
        {item.criadaPor ? ` por ${item.criadaPor}` : ''} · ainda sem sugestão do vigia
      </p>
      <BarraAcoes alvo={item} concluida={concluida} aoAcao={aoAcao} />
    </li>
  );
}

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
  aoAcao: (acao: AcaoCartao, alvo: AlvoAcao) => void;
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
      <BarraAcoes
        alvo={{ tarefaId: item.tarefaId, conteudo: item.conteudo, duplicadoDe: s.duplicadoDe }}
        concluida={concluida}
        aoAcao={aoAcao}
      />
    </li>
  );
}

export default function TriagemPage() {
  const [painel, setPainel] = useState<PainelRevisao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluidas, setConcluidas] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ tipo: 'excluir' | 'mesclar'; item: AlvoAcao } | null>(null);
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

  async function chamarAcao(
    corpo: Record<string, string>,
  ): Promise<Record<string, unknown> | null> {
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
      return dados as Record<string, unknown>;
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não consegui falar com o Todoist agora.');
      return null;
    } finally {
      setOcupado(false);
    }
  }

  function tirarDaLista(...ids: string[]) {
    const fica = (i: { tarefaId: string }) => !ids.includes(i.tarefaId);
    setPainel((p) =>
      p
        ? {
            ...p,
            itens: p.itens.filter(fica),
            semClassificacao: p.semClassificacao.filter(fica),
            lembretes: p.lembretes.filter(fica),
          }
        : p,
    );
  }

  async function aoAcao(acao: AcaoCartao, item: AlvoAcao) {
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

  async function adiar(tarefaId: string, opcao: string, data?: string): Promise<string | null> {
    const corpo: Record<string, string> = { acao: 'adiar', tarefaId, opcao };
    if (data) corpo.data = data;
    const dados = await chamarAcao(corpo);
    return typeof dados?.para === 'string' ? dados.para : null;
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
          sugerida={modal.item.duplicadoDe ?? null}
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
          {painel.semClassificacao.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-medium text-text-secondary">
                Sem classificação ({painel.semClassificacao.length})
              </h2>
              <ul className="mt-3 space-y-3">
                {painel.semClassificacao.map((i) => (
                  <CartaoSemSugestao
                    key={i.tarefaId}
                    item={i}
                    concluida={concluidas.has(i.tarefaId)}
                    aoAcao={aoAcao}
                  />
                ))}
              </ul>
            </>
          )}
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
          <SecaoLembretes
            lembretes={painel.lembretes}
            concluidas={concluidas}
            aoAcao={aoAcao}
            aoAdiar={adiar}
          />
        </>
      )}
    </div>
  );
}
