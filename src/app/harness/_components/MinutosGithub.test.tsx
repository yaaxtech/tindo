import { MinutosGithub } from '@/app/harness/_components/MinutosGithub';
import type { ActionsBlob, ActionsSnapshot } from '@/types/harness';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// Render de verdade, não só a lib pura: um KPI que calcula certo mas explode ao
// pintar (ou some sem dados) chega ao dono como bloco vazio, e o painel inteiro
// perde a credibilidade.

function blob(over: Partial<ActionsBlob> = {}): ActionsBlob {
  return {
    gerado_em: '2026-08-13T12:00:00Z',
    ciclo_inicio: '2026-08-01',
    cota_min: 2_000,
    custo_min_usd: 0.008,
    repos: ['seucamarao/seucamaraov1'],
    dias: [
      {
        dia: '2026-08-10',
        repo: 'seucamarao/seucamaraov1',
        min_faturado: 0,
        min_mac: 1_000,
        runs: 40,
        jobs: 60,
        jobs_falha: 6,
        jobs_cancelado: 4,
        min_perdido: 100,
        fila_seg: [600, 900],
      },
    ],
    branches: [
      { branch: 'claude/refatora-tudo', runs: 20, min_total: 600, virou_pr: false, mergeado: false },
      { branch: 'fix/ci', runs: 5, min_total: 400, virou_pr: true, mergeado: true },
    ],
    steps: [
      { nome: 'Unit tests (Vitest)', seg_total: 750, n: 40 },
      { nome: 'Typecheck', seg_total: 250, n: 40 },
    ],
    fila_por_hora: [{ hora: 15, p50: 600, p90: 900, n: 12 }],
    prs_mergeados_ciclo: 5,
    destino: { RUNNER_CI: 'self-hosted-mac', RUNNER_LEVE: 'self-hosted-mac-light' },
    parcial: null,
    ...over,
  };
}

const snapshot = (over?: Partial<ActionsBlob>): ActionsSnapshot => ({
  dados: blob(over),
  geradoEm: '2026-08-13T12:00:00Z',
});

describe('MinutosGithub', () => {
  it('explica a ausência de dados em vez de sumir da tela', () => {
    render(<MinutosGithub snapshot={null} />);
    expect(screen.getByText(/A coleta ainda não rodou/)).toBeInTheDocument();
  });

  it('mostra o veredito e o custo de ligar a nuvem mesmo com tudo rodando no Mac', () => {
    render(<MinutosGithub snapshot={snapshot()} />);
    expect(screen.getByText('Veredito')).toBeInTheDocument();
    // O cenário real: faturado zero, mas o painel precisa precificar a decisão.
    expect(screen.getByText(/Se ligasse a nuvem/)).toBeInTheDocument();
    expect(
      screen.getByText(/custo de mandar tudo para a nuvem ÷ horas de fila/),
    ).toBeInTheDocument();
  });

  it('avisa quando a coleta veio incompleta, em vez de mostrar número parcial calado', () => {
    render(<MinutosGithub snapshot={snapshot({ parcial: 'teto de 400 runs atingido' })} />);
    expect(screen.getByText(/Coleta parcial/)).toBeInTheDocument();
  });
});
