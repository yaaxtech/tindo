import type { LedgerLinha } from '@/types/harness';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Terrenos } from './Terrenos';

const cadeia = (rotulo: string, modelo: string) => ({
  rotulo,
  default: modelo,
  fallback: ['fallback-modelo'],
  piso: false,
  revisor: 'revisor',
});

const rotas = { rotina: cadeia('Código rotineiro', 'Sol (low)') };

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
  it('mostra uma rota e soma os despachos de ambos os provedores', () => {
    const { container } = render(
      <Terrenos linhas={[linha('claude'), linha('codex')]} cadeias={rotas} />,
    );

    expect(screen.getByText('Sol (low)')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText('Frente da rota')).not.toBeInTheDocument();
    expect(screen.getByText(/Uma rota por tipo de tarefa/)).toBeInTheDocument();
    expect(container.textContent).toContain('2 despachos');
    expect(container.textContent).toContain('100% · 2/2');
    expect(screen.getByText('Fallback 1')).toBeInTheDocument();
  });

  it('explica que uma janela vazia não apaga evidência de outras janelas', () => {
    render(<Terrenos linhas={[]} linhasGeral={[linha('codex')]} cadeias={rotas} />);

    expect(screen.getByText(/Sem dados no período selecionado/)).toBeInTheDocument();
    expect(screen.getByText(/há 1 registro.*em outras janelas/)).toBeInTheDocument();
  });
});
