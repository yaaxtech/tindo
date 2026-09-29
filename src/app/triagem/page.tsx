'use client';

import type { PlanoTriagem } from '@/lib/triagem/plano';
import type { PreviaTriagem } from '@/services/triagem';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const QUANDO_TEXTO: Record<PlanoTriagem['quando'], string> = {
  manter: 'mantém a data',
  hoje_manha: 'hoje de manhã',
  hoje_tarde: 'hoje à tarde',
  hoje_noite: 'hoje à noite',
  amanha: 'amanhã',
  proxima_semana: 'próxima semana',
  sem_data: 'sem data',
};

function prioridadeVisual(api: number): string {
  return `P${5 - api}`;
}

function LinhaPlano({ plano, nomes }: { plano: PlanoTriagem; nomes: Record<string, string> }) {
  const mudouProjeto = plano.antes.projetoId !== plano.depois.projetoId;
  const novas = plano.depois.etiquetas.filter((e) => !plano.antes.etiquetas.includes(e));
  return (
    <li className="rounded-lg border border-[#1B222C] bg-bg-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-text-primary">{plano.conteudo}</p>
        <span
          className={
            plano.revisar
              ? 'shrink-0 rounded px-2 py-0.5 text-xs bg-[#F2B94B]/15 text-[#F2B94B]'
              : 'shrink-0 rounded px-2 py-0.5 text-xs bg-[#198B74]/15 text-[#2CAF93]'
          }
        >
          {plano.revisar ? 'Para você revisar' : 'Aplicaria sozinho'}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-text-muted">Tipo</dt>
          <dd className="text-text-secondary">
            {plano.tipo === 'lembrete' ? 'Lembrete' : 'Tarefa'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Projeto</dt>
          <dd className="text-text-secondary">
            {mudouProjeto ? (nomes[plano.depois.projetoId] ?? '?') : 'fica na Entrada'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Prioridade · quando</dt>
          <dd className="text-text-secondary">
            {prioridadeVisual(plano.depois.prioridadeApi)} · {QUANDO_TEXTO[plano.quando]}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Etiquetas novas</dt>
          <dd className="text-text-secondary">{novas.join(', ') || '—'}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-text-muted">
        {plano.explicacao} · confiança {Math.round(plano.confianca * 100)}%
        {plano.frenteExistenteId ? ' · parece passo de uma frente aberta' : ''}
      </p>
      {plano.avisos.length > 0 && (
        <p className="mt-1 text-xs text-[#F2B94B]">{plano.avisos.join(' ')}</p>
      )}
    </li>
  );
}

export default function TriagemPage() {
  const [previa, setPrevia] = useState<PreviaTriagem | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch('/api/triagem/previa');
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo.erro ?? 'Não foi possível gerar a prévia.');
      setPrevia(corpo as PreviaTriagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar a prévia.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Triagem da Entrada</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Prévia: é o que a IA faria nos itens novos da sua Entrada. Nada foi alterado no Todoist.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          disabled={carregando}
          className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-border-strong px-3 text-sm hover:border-jade-accent disabled:opacity-50"
        >
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} aria-hidden="true" />
          Gerar de novo
        </button>
      </div>

      {erro && (
        <p role="alert" className="mt-6 text-sm text-danger">
          {erro}
        </p>
      )}
      {carregando && !previa && (
        <p className="mt-6 text-sm text-text-muted">Lendo a Entrada e consultando a IA…</p>
      )}

      {previa && (
        <>
          <p className="mt-6 text-sm text-text-muted">
            {previa.totalNaEntrada} itens na Entrada, {previa.pendentesDeTriagem} ainda sem triagem.
            Mostrando {previa.planos.length}.
          </p>
          {previa.planos.length === 0 && previa.erros.length === 0 && (
            <p className="mt-4 text-sm text-text-secondary">Sua Entrada está em dia.</p>
          )}
          <ul className="mt-4 space-y-3">
            {previa.planos.map((p) => (
              <LinhaPlano key={p.tarefaId} plano={p} nomes={previa.nomesProjetos} />
            ))}
          </ul>
          {previa.erros.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-danger">
              {previa.erros.map((e) => (
                <li key={e.tarefaId}>
                  {e.conteudo}: {e.erro}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
