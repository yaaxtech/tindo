import { PaginaHarness } from '@/app/harness/_components/PaginaHarness';
import type { HarnessV2 } from '@/types/harness';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/snapshot-v2.json';

const base = fixture as unknown as HarnessV2;
const renderV2 = (s: unknown) => render(<PaginaHarness estado={{ tipo: 'pronto', dados: s }} />);

describe('/harness v2', () => {
  it('renderiza os blocos na ordem com a fixture', () => {
    renderV2(base);
    expect(screen.getByTestId('nota-valor').textContent).toBe('72');
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titulos).toEqual([
      'Nota da semana',
      'Precisa de você',
      'Mapa por área',
      'Testes em andamento',
      'Assinaturas',
      'Aderência por conta',
      'Diário de decisões',
      'Saúde da medição',
      'Para IAs',
    ]);
    expect(screen.getAllByTestId(/^area-/)).toHaveLength(8);
    expect(screen.getByText('Quer subir')).toBeTruthy();
  });

  it('atenção vazia mostra estado positivo', () => {
    renderV2({ ...base, atencao: [] });
    expect(screen.getByTestId('atencao-vazia').textContent).toMatch(/Nada precisa de você/);
  });

  it('ok1 nulo aparece como traço, não 0%', () => {
    renderV2(base);
    const cerebro = screen.getByTestId('area-cerebro');
    expect(within(cerebro).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(cerebro).queryByText('0,0%')).toBeNull();
  });

  it('snapshot antigo mostra aviso em vez de quebrar', () => {
    renderV2({ versao: 1, ledger: [] });
    expect(screen.getByTestId('snapshot-antigo').textContent).toMatch(/aguardando publicação v2/);
  });
});
