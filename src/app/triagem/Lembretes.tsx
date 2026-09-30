'use client';

import type { ItemLembrete } from '@/services/triagem-revisao';
import { AlertTriangle, CalendarClock, Moon, Sparkles, Sun, Sunrise } from 'lucide-react';
import { useState } from 'react';
import { type AcaoCartao, type AlvoAcao, BarraAcoes, Detalhes, formatarData } from './Comum';

type Adiar = (tarefaId: string, opcao: string, data?: string) => Promise<string | null>;

const botaoCls =
  'flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 hover:border-jade-accent hover:text-jade-accent disabled:opacity-50';

function precisaAtencao(l: ItemLembrete): boolean {
  return l.tipo.pareceTarefa || l.sugestao.destino !== null;
}

function CartaoLembrete({
  item,
  concluida,
  aoAcao,
  aoAdiar,
}: {
  item: ItemLembrete;
  concluida: boolean;
  aoAcao: (acao: AcaoCartao, alvo: AlvoAcao) => void;
  aoAdiar: Adiar;
}) {
  const [adiadoPara, setAdiadoPara] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [outraData, setOutraData] = useState('');
  const [pedindoData, setPedindoData] = useState(false);

  async function adiar(opcao: string, data?: string) {
    setOcupado(true);
    const para = await aoAdiar(item.tarefaId, opcao, data);
    setOcupado(false);
    if (para) {
      setAdiadoPara(para);
      setPedindoData(false);
      setOutraData('');
    }
  }

  const s = item.sugestao;
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
            {item.projetoAtual} · {item.prioridade} ·{' '}
            {item.vencimentoTexto ?? formatarData(item.vencimento)}
            {s.atraso > 0 && <span className="text-[#E3546C]"> · {s.atraso}d atrasado</span>}
          </p>
        </div>
      </div>

      {item.tipo.pareceTarefa && (
        <p className="mt-2 flex items-start gap-1 text-xs text-[#F2B94B]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          Parece tarefa, não lembrete: {item.tipo.motivo}
        </p>
      )}
      {s.texto !== 'Em dia.' && (
        <p className="mt-1 text-xs text-text-secondary">
          <span className="text-text-muted">Sugestão: </span>
          {s.texto}
        </p>
      )}
      {adiadoPara && (
        <p className="mt-2 text-xs text-[#2CAF93]">Adiado para {formatarData(adiadoPara)}.</p>
      )}

      <BarraAcoes alvo={item} concluida={concluida} aoAcao={aoAcao}>
        {s.destino && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void adiar('sugestao')}
            className="flex items-center gap-1 rounded-md border border-[#198B74]/60 px-2 py-1 text-[#2CAF93] hover:bg-[#198B74]/10 disabled:opacity-50"
          >
            <Sparkles size={12} aria-hidden="true" /> Aceitar:{' '}
            {formatarData(s.destino.dataHoraLocal)}
          </button>
        )}
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void adiar('tarde')}
          className={botaoCls}
        >
          <Sun size={12} aria-hidden="true" /> Tarde
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void adiar('noite')}
          className={botaoCls}
        >
          <Moon size={12} aria-hidden="true" /> Noite
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void adiar('amanha')}
          className={botaoCls}
        >
          <Sunrise size={12} aria-hidden="true" /> Amanhã
        </button>
        {pedindoData ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (outraData.trim()) void adiar('data', outraData.trim());
            }}
          >
            <input
              // biome-ignore lint/a11y/noAutofocus: o campo só aparece depois do clique em "Outra data".
              autoFocus
              value={outraData}
              onChange={(e) => setOutraData(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setPedindoData(false)}
              placeholder="dd/mm"
              aria-label="Nova data"
              className="h-7 w-20 rounded-md border border-border-strong bg-bg-deep px-2 text-xs"
            />
            <button type="submit" disabled={ocupado} className={botaoCls}>
              Adiar
            </button>
          </form>
        ) : (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => setPedindoData(true)}
            className={botaoCls}
          >
            <CalendarClock size={12} aria-hidden="true" /> Outra data
          </button>
        )}
      </BarraAcoes>
    </li>
  );
}

export function SecaoLembretes({
  lembretes,
  concluidas,
  aoAcao,
  aoAdiar,
}: {
  lembretes: ItemLembrete[];
  concluidas: Set<string>;
  aoAcao: (acao: AcaoCartao, alvo: AlvoAcao) => void;
  aoAdiar: Adiar;
}) {
  const [todos, setTodos] = useState(false);
  const atencao = lembretes.filter(precisaAtencao);
  const lista = todos ? lembretes : atencao;

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Lembretes</h2>
          <p className="text-xs text-text-muted">
            {atencao.length} pedem atenção de {lembretes.length}. Tarde = 14h, noite = 19h, amanhã =
            9h.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTodos((v) => !v)}
          className="shrink-0 text-xs text-text-muted underline hover:text-jade-accent"
        >
          {todos ? 'Só os que pedem atenção' : 'Mostrar todos'}
        </button>
      </div>
      {lista.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">Nenhum lembrete pedindo atenção.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {lista.map((l) => (
            <CartaoLembrete
              key={l.tarefaId}
              item={l}
              concluida={concluidas.has(l.tarefaId)}
              aoAcao={aoAcao}
              aoAdiar={aoAdiar}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
