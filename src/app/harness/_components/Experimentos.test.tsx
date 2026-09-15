import type { BenchmarkModelosPublicado, ExperimentosPublicados } from '@/types/harness';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Experimentos } from './Experimentos';

describe('Experimentos', () => {
  it('avisa quando os resultados automáticos ainda não foram publicados e mantém o histórico', () => {
    render(<Experimentos />);

    expect(screen.getByText(/resultados automáticos ainda não publicados/)).toBeInTheDocument();
    expect(screen.getByText('Histórico de pilotos manuais')).toBeInTheDocument();
    expect(screen.getAllByText('histórico manual').length).toBeGreaterThan(0);
  });

  it('mostra métricas dos braços publicados sem transformar null em zero', () => {
    const dados: ExperimentosPublicados = {
      gerado_em: '2026-09-15T10:00:00Z',
      experimentos: [
        {
          id: 'ab-rotina',
          terreno: 'rotina',
          frente: 'codex',
          status: 'em medição',
          motivo: 'amostra ainda aberta',
          bracos: [
            {
              id: 'A',
              modelo: 'Astra',
              effort: 'high',
              execucoes: 4,
              julgados: 3,
              ok1: 2,
              retrabalho: 1,
              quota: 0,
              infra: 0,
              tokens_mediana: null,
              duracao_mediana_min: null,
              tokens_medidos: 2,
              pendentes: 1,
              falhas: 0,
              duracoes_medidas: null,
            },
          ],
        },
      ],
    };

    render(<Experimentos dados={dados} />);

    expect(screen.getByText('em medição')).toBeInTheDocument();
    expect(screen.getByText('Motivo publicado: amostra ainda aberta')).toBeInTheDocument();
    expect(screen.getAllByText('2/3')).toHaveLength(2);
    expect(screen.getByText('Tokens medidos/julgados').parentElement).toHaveTextContent('2/3');
    expect(screen.getByText('Tokens mediana').parentElement).toHaveTextContent('—');
    expect(screen.getByText('Duração mediana').parentElement).toHaveTextContent('—');
    expect(screen.getByText('Pendentes').parentElement).toHaveTextContent('1');
    expect(screen.getByText('Falhas').parentElement).toHaveTextContent('0');
    expect(screen.getByText('Durações medidas').parentElement).toHaveTextContent('—');
  });

  it('mantém benchmark externo recolhível e explica o limite da comparação', () => {
    const benchmark: BenchmarkModelosPublicado = {
      fonte: 'Arena',
      url: 'https://example.com/arena',
      consultado_em: '2026-09-15',
      projecao: 'referência de capacidade',
      nota: 'dados externos',
      modelos: [
        {
          id: 'astra',
          nome: 'Astra',
          organizacao: 'OpenAI',
          score: 90,
          score_margem: null,
          sessoes: 43,
          output_tokens_mediana: null,
          amostra_tokens: 0,
        },
      ],
    };

    render(<Experimentos benchmarkModelos={benchmark} />);

    const details = screen.getByText(/Benchmark externo — Arena/).closest('details');
    expect(details).not.toBeNull();
    fireEvent.click(screen.getByText(/Benchmark externo — Arena/));
    expect(screen.getByRole('link', { name: 'abrir fonte' })).toHaveAttribute(
      'href',
      benchmark.url,
    );
    expect(screen.getByText(/não prova o esforço local/)).toBeInTheDocument();
    const benchmarkRow = within(details as HTMLElement)
      .getByText('Astra')
      .closest('tr');
    expect(benchmarkRow).toHaveTextContent('—');
  });
});
