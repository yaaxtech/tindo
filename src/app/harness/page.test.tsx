import { PaginaHarness } from '@/app/harness/_components/PaginaHarness';
import type { HarnessV2 } from '@/types/harness';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

describe('respostas do dono', () => {
  const proposta = base.atencao.find((a) => a.tipo === 'proposta_subir');
  const id = proposta?.id ?? 'P-3';

  it('dono aprova com confirmação na página e vê o estado', async () => {
    const responder = vi.fn().mockResolvedValue({ ok: true });
    render(
      <PaginaHarness
        estado={{ tipo: 'pronto', dados: base }}
        respostas={{ dono: true, respostas: {}, responder }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(responder).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sim, aprovar' }));
    await waitFor(() =>
      expect(screen.getByTestId(`resposta-${id}`).textContent).toMatch(
        /Aprovado — aplica na próxima hora/,
      ),
    );
    expect(responder).toHaveBeenCalledWith(id, 1);
  });

  it('dono recusa; erro do serviço aparece e mantém os botões', async () => {
    const responder = vi.fn().mockResolvedValue({ ok: false, erro: 'Não consegui salvar.' });
    render(
      <PaginaHarness
        estado={{ tipo: 'pronto', dados: base }}
        respostas={{ dono: true, respostas: {}, responder }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sim, recusar' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Não consegui/));
    expect(responder).toHaveBeenCalledWith(id, -1);
  });

  it('visitante não vê botões, só o status', () => {
    render(
      <PaginaHarness
        estado={{ tipo: 'pronto', dados: base }}
        respostas={{ dono: false, respostas: { [id]: -1 }, responder: vi.fn() }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull();
    expect(screen.getByTestId(`resposta-${id}`).textContent).toMatch(/Recusado/);
  });
});
