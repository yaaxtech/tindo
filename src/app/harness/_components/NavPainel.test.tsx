import { NavPainel } from '@/app/harness/_components/NavPainel';
import { SECOES_PAINEL } from '@/app/harness/_components/secoes';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// O menu de âncoras não pode depender da animação nativa de rolagem suave.
// Bug de 2026-08-13: com `scroll-behavior: smooth` no <html>, clicar num item
// mudava o hash e acendia o item, mas a página não saía do lugar sempre que o
// navegador não pintava quadros para a aba (segundo plano, janela oculta, PWA
// em background) — a animação nativa simplesmente nunca avança nesse estado.
// Estes testes travam o contrato do conserto: o clique manda rolar por conta
// própria e CONFERE a chegada, forçando salto seco se a animação não andou.

/**
 * Monta uma seção-alvo com geometria controlada: jsdom não faz layout, então
 * dizemos onde a seção está (`topo`, relativo à janela) e qual a altura
 * rolável da página.
 */
function montarPagina({ topo = 2000, alturaPagina = 5000 } = {}) {
  const secao = document.createElement('section');
  secao.id = 'assinaturas';
  document.body.appendChild(secao);
  // Onde a seção está agora. Uma rolagem "instantânea" a leva ao lugar certo;
  // a suave não move nada — é justamente o cenário do bug.
  let topoAtual = topo;
  vi.spyOn(secao, 'getBoundingClientRect').mockImplementation(
    () => ({ top: topoAtual }) as DOMRect,
  );
  secao.scrollIntoView = vi.fn((opcoes?: boolean | ScrollIntoViewOptions) => {
    if (typeof opcoes === 'object' && opcoes?.behavior === 'instant') topoAtual = 0;
  });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: alturaPagina,
  });
  return secao;
}

/** Os `behavior` pedidos ao `scrollIntoView` da seção, em ordem. */
function rolagensPedidas(secao: HTMLElement) {
  const mock = secao.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
  return mock.mock.calls.map(([o]) => (o as ScrollIntoViewOptions)?.behavior);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // jsdom não tem ResizeObserver — a nav usa um para medir a própria altura.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  window.scrollY = 0;
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('NavPainel — navegação por âncora', () => {
  it('clicar num item rola até a seção sem depender do salto nativo do navegador', () => {
    const secao = montarPagina();
    render(<NavPainel grupos={SECOES_PAINEL} />);

    const link = screen.getByRole('link', { name: /Assinaturas/ });
    const evento = fireEvent.click(link);

    // O default do navegador foi cancelado: quem rola é o nosso código.
    expect(evento).toBe(false);
    expect(rolagensPedidas(secao)).toContain('smooth');
    expect(window.location.hash).toBe('#assinaturas');
  });

  it('se a rolagem suave não andar, força o salto seco até a seção', () => {
    const secao = montarPagina();
    render(<NavPainel grupos={SECOES_PAINEL} />);

    fireEvent.click(screen.getByRole('link', { name: /Assinaturas/ }));
    // Nada se moveu (é exatamente o que acontece com a aba em segundo plano).
    expect(secao.getBoundingClientRect().top).toBe(2000);

    vi.advanceTimersByTime(3000);

    expect(rolagensPedidas(secao)).toContain('instant');
    expect(secao.getBoundingClientRect().top).toBe(0);
  });

  it('não força nada quando a rolagem já chegou ao destino', () => {
    // Seção já no topo da janela: destino = onde a página já está.
    const secao = montarPagina({ topo: 0 });
    render(<NavPainel grupos={SECOES_PAINEL} />);

    fireEvent.click(screen.getByRole('link', { name: /Assinaturas/ }));
    vi.advanceTimersByTime(3000);

    expect(rolagensPedidas(secao)).not.toContain('instant');
  });

  it('não impõe rolagem suave global no documento', () => {
    montarPagina();
    render(<NavPainel grupos={SECOES_PAINEL} />);
    expect(document.documentElement.style.scrollBehavior).toBe('');
  });
});
