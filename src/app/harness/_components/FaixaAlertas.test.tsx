import type { HistoricoAlertas } from '@/services/harness';
import type { AlertaLinha, AvaliacaoLinha, CodigoAlerta } from '@/types/harness';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FaixaAlertas } from './FaixaAlertas';

const avaliacao = (id: string, dia: string, violacoes = 0): AvaliacaoLinha => ({
  id,
  avaliado_em: `2026-08-${dia}T06:00:00.000Z`,
  motivo: 'periodico',
  janela_dias: 14,
  violacoes_n: violacoes,
});

let seq = 0;
const alerta = (
  avaliacaoId: string,
  dia: string,
  codigo: CodigoAlerta,
  extra: Partial<AlertaLinha> = {},
): AlertaLinha => ({
  id: `a${seq++}`,
  avaliacao_id: avaliacaoId,
  avaliado_em: `2026-08-${dia}T06:00:00.000Z`,
  codigo,
  severidade: 'alerta',
  valor: 0.755,
  limiar: 0.8,
  amostra: 98,
  ...extra,
});

describe('FaixaAlertas', () => {
  it('não renderiza nada antes da primeira avaliação', () => {
    const { container } = render(<FaixaAlertas historico={undefined} />);
    expect(container).toBeEmptyDOMElement();

    const vazio = render(<FaixaAlertas historico={{ avaliacoes: [], alertas: [] }} />);
    expect(vazio.container).toBeEmptyDOMElement();
  });

  it('diz que está tudo certo quando a última checagem não achou nada', () => {
    const historico: HistoricoAlertas = {
      avaliacoes: [avaliacao('av1', '13')],
      alertas: [],
    };
    render(<FaixaAlertas historico={historico} />);
    expect(screen.getByText(/Nenhum número passou do limite/)).toBeInTheDocument();
    expect(screen.getByText(/checado em 13\/08/)).toBeInTheDocument();
  });

  it('mostra só os alertas da última checagem, com valor e limiar em %', () => {
    const historico: HistoricoAlertas = {
      avaliacoes: [avaliacao('av2', '13', 1), avaliacao('av1', '30')],
      alertas: [
        alerta('av2', '13', 'qualidade_baixa'),
        alerta('av1', '30', 'custo_alto', { valor: 7.5, limiar: 5 }),
      ],
    };
    render(<FaixaAlertas historico={historico} />);

    expect(screen.getByText('Qualidade abaixo da meta')).toBeInTheDocument();
    expect(screen.getByText(/76% · combinado ≥ 80%/)).toBeInTheDocument();
    // O alerta da checagem anterior não aparece como vigente.
    expect(screen.queryByText('Custo por tarefa alto')).not.toBeInTheDocument();
  });

  it('formata custo em dólar e tempo do GitHub em minutos', () => {
    const historico: HistoricoAlertas = {
      avaliacoes: [avaliacao('av1', '13', 2)],
      alertas: [
        alerta('av1', '13', 'custo_alto', { valor: 7.5, limiar: 5, amostra: 12 }),
        alerta('av1', '13', 'espera_merge_longa', { valor: 5400, limiar: 3600, amostra: 4 }),
      ],
    };
    render(<FaixaAlertas historico={historico} />);

    expect(screen.getByText(/\$7\.50 · combinado ≤ \$5\.00/)).toBeInTheDocument();
    // 5400 s cai na faixa de horas; o limiar de 3600 s ainda é lido em minutos.
    expect(screen.getByText(/1\.5 h · combinado ≤ 60 min/)).toBeInTheDocument();
    expect(screen.getByText(/calculado sobre 12 tarefas entregues/)).toBeInTheDocument();
    expect(screen.getByText(/calculado sobre 4 execuções do GitHub/)).toBeInTheDocument();
  });

  it('conta em quantas checagens o mesmo limiar apareceu', () => {
    const historico: HistoricoAlertas = {
      avaliacoes: [avaliacao('av3', '13', 1), avaliacao('av2', '30', 1), avaliacao('av1', '16', 1)],
      alertas: [
        alerta('av3', '13', 'qualidade_baixa'),
        alerta('av2', '30', 'qualidade_baixa'),
        alerta('av1', '16', 'qualidade_baixa'),
      ],
    };
    render(<FaixaAlertas historico={historico} />);

    expect(screen.getByText(/apareceu em 3 de 3 checagens/)).toBeInTheDocument();
    // Disparar em todas as checagens é barulho, e a tela precisa dizer isso.
    expect(screen.getByText(/aparece sempre, não é novidade/)).toBeInTheDocument();
  });

  it('marca a severidade crítica com texto diferente', () => {
    const historico: HistoricoAlertas = {
      avaliacoes: [avaliacao('av1', '13', 1)],
      alertas: [alerta('av1', '13', 'qualidade_baixa', { severidade: 'critico', limiar: 0.7 })],
    };
    render(<FaixaAlertas historico={historico} />);
    expect(screen.getByText('passou muito')).toBeInTheDocument();
  });
});
