import type { CadeiasPorFrente, LedgerLinha } from '@/types/harness';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Terrenos } from './Terrenos';

const cadeia = (rotulo: string, modelo: string) => ({
  rotulo,
  default: modelo,
  fallback: ['fallback-modelo'],
  piso: false,
  revisor: 'revisor',
});

const rotas: CadeiasPorFrente = {
  claude: { rotina: cadeia('Rotina Claude', 'modelo-claude') },
  codex: { rotina: cadeia('Rotina Codex', 'modelo-codex') },
};

const linha = (frente: LedgerLinha['frente']): LedgerLinha => ({
  ts: '2026-09-15T12:00:00Z',
  frente,
  modelo: 'modelo',
  effort: 'high',
  terreno: 'rotina',
  resultado: 'ok1',
  dur: 1,
  auto: true,
  papel: 'construtor',
});

describe('Terrenos', () => {
  it('seleciona a rota e filtra os despachos pela frente escolhida', () => {
    render(
      <Terrenos
        linhas={[linha('claude'), linha('codex')]}
        cadeias={rotas.claude}
        cadeiasPorFrente={rotas}
      />,
    );

    expect(screen.getByText('modelo-claude')).toBeInTheDocument();
    expect(screen.queryByText('modelo-codex')).not.toBeInTheDocument();
    expect(screen.getByText(/Titular/)).toBeInTheDocument();
    expect(screen.getByText('Fallback 1')).toBeInTheDocument();
    expect(
      screen.getByText(/entra quando o modelo anterior falha ou bate quota/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Codex' }));

    expect(screen.getByText('modelo-codex')).toBeInTheDocument();
    expect(screen.queryByText('modelo-claude')).not.toBeInTheDocument();
  });

  it('explica que uma janela vazia não apaga evidência de outras janelas', () => {
    render(
      <Terrenos
        linhas={[]}
        linhasGeral={[linha('codex')]}
        cadeias={rotas.codex}
        cadeiasPorFrente={rotas}
        frenteSelecionada="codex"
      />,
    );

    expect(
      screen.getByText(/Sem dados da frente Codex no período selecionado/),
    ).toBeInTheDocument();
    expect(screen.getByText(/há 1 registro.*em outras janelas/)).toBeInTheDocument();
  });
});
