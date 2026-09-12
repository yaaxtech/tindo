'use client';

/*
 * Única ilha interativa da vitrine: as setas do teclado e o contador da barra.
 * Os cards são links renderizados no servidor — clique, Enter, roda do meio e
 * Ctrl/Cmd+clique já funcionam sem JavaScript nenhum. Aqui só entra o que o
 * HTML não dá de graça: mover o foco entre eles e dizer em qual você está.
 */

import { useEffect, useRef, useState } from 'react';

/** Marcador posto em cada card pela página (Server Component). */
const SELETOR_CARTAO = '[data-yx-cartao]';

/** Onde 1/2/3 deve continuar digitando em vez de navegar. */
const CAMPOS_DE_TEXTO = 'input, textarea, select, [contenteditable="true"]';

const PROXIMO = new Set(['ArrowRight', 'ArrowDown', 'l', 'j']);
const ANTERIOR = new Set(['ArrowLeft', 'ArrowUp', 'h', 'k']);

interface NavegacaoCardsProps {
  /** Quantidade de cards na vitrine — o denominador do contador. */
  total: number;
}

export function NavegacaoCards({ total }: NavegacaoCardsProps) {
  const [posicao, setPosicao] = useState(1);
  const posicaoRef = useRef(1);

  useEffect(() => {
    function listar(): HTMLAnchorElement[] {
      return Array.from(document.querySelectorAll<HTMLAnchorElement>(SELETOR_CARTAO));
    }

    function elementoDe(evento: Event): HTMLElement | null {
      return evento.target instanceof HTMLElement ? evento.target : null;
    }

    function marcar(indice: number) {
      const humana = indice + 1;
      posicaoRef.current = humana;
      setPosicao(humana);
    }

    function focar(indice: number) {
      const cartoes = listar();
      if (cartoes.length === 0) return;
      const alvo = ((indice % cartoes.length) + cartoes.length) % cartoes.length;
      cartoes[alvo]?.focus();
    }

    function aoFocar(evento: FocusEvent) {
      const cartao = elementoDe(evento)?.closest(SELETOR_CARTAO);
      if (!cartao) return;
      const indice = listar().indexOf(cartao as HTMLAnchorElement);
      if (indice >= 0) marcar(indice);
    }

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.ctrlKey || evento.metaKey || evento.altKey) return;

      const alvo = elementoDe(evento);
      if (alvo?.closest(CAMPOS_DE_TEXTO)) return;

      const cartoes = listar();
      if (cartoes.length === 0) return;

      const atual = alvo?.closest(SELETOR_CARTAO) ?? null;
      // Fora dos cards, a primeira seta traz o foco para onde o contador aponta.
      const indice = atual ? cartoes.indexOf(atual as HTMLAnchorElement) : Number.NaN;
      const foraDaPilha = Number.isNaN(indice) || indice < 0;
      const base = foraDaPilha ? posicaoRef.current - 1 : indice;

      if (PROXIMO.has(evento.key)) {
        evento.preventDefault();
        focar(foraDaPilha ? base : base + 1);
        return;
      }

      if (ANTERIOR.has(evento.key)) {
        evento.preventDefault();
        focar(foraDaPilha ? base : base - 1);
        return;
      }

      if (evento.key >= '1' && evento.key <= '9') {
        const destino = cartoes[Number(evento.key) - 1];
        if (!destino) return;
        evento.preventDefault();
        destino.focus();
        // Clique sintético: mantém a navegação client-side do Next, sem
        // reimplementar o href aqui.
        destino.click();
      }
    }

    document.addEventListener('focusin', aoFocar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('focusin', aoFocar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, []);

  return (
    <div className="yx-pos" aria-hidden="true">
      <span>{posicao}</span>/{total}
    </div>
  );
}
