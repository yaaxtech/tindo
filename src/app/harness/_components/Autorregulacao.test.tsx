import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Autorregulacao } from './Autorregulacao';

describe('Autorregulacao', () => {
  it('mostra estado, motivo e última mudança publicados', () => {
    render(
      <Autorregulacao
        dados={{
          habilitada: true,
          gerado_em: '2026-09-15T10:00:00Z',
          motivo: 'limiar de segurança mantido',
          ultima_mudanca: '2026-09-14T09:00:00Z',
        }}
      />,
    );

    expect(screen.getByText('habilitada')).toBeInTheDocument();
    expect(screen.getByText('limiar de segurança mantido')).toBeInTheDocument();
    expect(screen.getByText(/Última mudança: 2026-09-14/)).toBeInTheDocument();
  });

  it('deixa claro quando o estado ainda não foi publicado', () => {
    render(<Autorregulacao />);

    expect(screen.getByText(/Dados de autorregulação ainda não publicados/)).toBeInTheDocument();
  });
});
