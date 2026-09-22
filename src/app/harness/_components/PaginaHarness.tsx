'use client';

import { PainelV2, ehSnapshotV2 } from './PainelV2';
import { fmtData } from './formato';

export type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; msg: string }
  | { tipo: 'vazio' }
  | { tipo: 'pronto'; dados: unknown };

export function PaginaHarness({ estado }: { estado: Estado }) {
  const v2 = estado.tipo === 'pronto' && ehSnapshotV2(estado.dados) ? estado.dados : null;
  return (
    <main className="min-h-dvh pb-16 safe-top safe-bottom">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          <h1 className="text-lg font-semibold text-text-primary">Painel do Harness</h1>
          <p className="text-sm text-text-muted">
            Quais IAs fazem cada trabalho, quanto acertam e quanto custam.
            {v2 && <> Atualizado em {fmtData(v2.gerado_em)}.</>}
          </p>
        </div>
      </header>
      <div className="mx-auto mt-6 w-full max-w-4xl px-4 sm:px-6">
        {estado.tipo === 'carregando' && <p className="text-sm text-text-muted">Carregando…</p>}
        {estado.tipo === 'erro' && (
          <p role="alert" className="text-sm text-danger">
            Não consegui ler o painel: {estado.msg}
          </p>
        )}
        {estado.tipo === 'vazio' && (
          <p className="text-sm text-text-muted">Ainda não há dados publicados.</p>
        )}
        {estado.tipo === 'pronto' && !v2 && (
          <output data-testid="snapshot-antigo" className="block text-sm text-warning">
            Snapshot antigo — aguardando publicação v2.
          </output>
        )}
        {v2 && <PainelV2 s={v2} />}
      </div>
    </main>
  );
}
