import { Janela } from '@/app/harness/_components/Janela';
import type { JanelaBlob, JanelaCampo } from '@/types/harness';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// Render de verdade nos 4 estados do contrato: normal, ausente, erro e velho.
// Um bloco que calcula certo mas explode ao pintar chega ao dono como bloco
// vazio — e percentual sem amostra é proibido na tela.

function blob(over: Partial<JanelaBlob> = {}): JanelaBlob {
  return {
    gerado_em: new Date(Date.now() - 30 * 60e3).toISOString(),
    dias: 14,
    totais: {
      sessoes: 1074,
      chamadas: 89000,
      tokens: 18700000000,
      cache_read: 17800000000,
      output: 93000000,
    },
    kpis: {
      pct_prefixo: 0.96,
      pct_pos_200: 0.466,
      sessoes_acima_teto: { n: 74, pct: 0.069, teto: 200 },
      tokens_por_tarefa: 161000000,
      gestos: { subagentes: 210, chips: 12, compacts: 5, por_sessao: 0.21 },
    },
    por_modelo: [{ modelo: 'claude-opus-5', chamadas: 20695, tokens: 3627900000, pct: 0.194 }],
    faixas: [{ faixa: '0-50', sessoes: 657, tokens: 700000000, pct: 0.037 }],
    top_sessoes: [{ id: '4a4bb799', chamadas: 972, tokens: 316200000, modelo: 'claude-opus-5' }],
    ...over,
  };
}

describe('Janela', () => {
  it('estado normal: mostra os 4 tiles, gestos, faixas e top sessões — todo % com amostra', () => {
    render(<Janela campo={blob()} />);
    expect(screen.getByText(/Releitura de prefixo/)).toBeInTheDocument();
    expect(screen.getByText(/96%/)).toBeInTheDocument();
    expect(screen.getByText(/17,8 bi de 18,7 bi tokens/)).toBeInTheDocument();
    expect(screen.getByText(/Desperdício pós-200/)).toBeInTheDocument();
    expect(screen.getByText(/1\.074 sessões medidas/)).toBeInTheDocument();
    // Percentual nunca solto: o teto traz n de N junto.
    expect(screen.getByText('74 de 1.074 (6,9%)')).toBeInTheDocument();
    expect(screen.getByText('161 M')).toBeInTheDocument();
    expect(screen.getByText(/210 subagentes · 12 chips · 5 compacts/)).toBeInTheDocument();
    expect(screen.getByText(/0,21 por sessão/)).toBeInTheDocument();
    expect(screen.getByText('0-50')).toBeInTheDocument();
    expect(screen.getByText('4a4bb799')).toBeInTheDocument();
  });

  it('campo ausente: explica que a coleta não rodou — nunca zeros', () => {
    render(<Janela campo={undefined} />);
    expect(screen.getByText(/A coleta ainda não rodou/)).toBeInTheDocument();
    expect(screen.queryByText(/Releitura de prefixo/)).not.toBeInTheDocument();
  });

  it('campo com erro: explica a falha, sem números de outro período', () => {
    const campo: JanelaCampo = { erro: 'falha ao ler o log local', gerado_em: blob().gerado_em };
    render(<Janela campo={campo} />);
    expect(screen.getByText(/A coleta falhou/)).toBeInTheDocument();
    expect(screen.getByText(/falha ao ler o log local/)).toBeInTheDocument();
    expect(screen.queryByText(/Releitura de prefixo/)).not.toBeInTheDocument();
  });

  it('gerado_em velho: aviso "sem coleta desde" em cima dos números, que continuam visíveis', () => {
    render(<Janela campo={blob({ gerado_em: new Date(Date.now() - 7 * 3600e3).toISOString() })} />);
    expect(screen.getByText(/Sem coleta desde/)).toBeInTheDocument();
    expect(screen.getByText(/Releitura de prefixo/)).toBeInTheDocument();
  });

  it('kpis com null: pinta "—" sem quebrar e sem inventar número', () => {
    render(
      <Janela
        campo={blob({
          kpis: {
            pct_prefixo: null,
            pct_pos_200: null,
            sessoes_acima_teto: null,
            tokens_por_tarefa: null,
            gestos: null,
          },
        })}
      />,
    );
    expect(screen.getByText(/Releitura de prefixo/)).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText(/dado insuficiente/)).toBeInTheDocument();
  });
});
