import type { Block } from '@blocknote/core';
import { describe, expect, it } from 'vitest';
import { montarNosEArestas } from './Mindmap';

// Constrói um Block mínimo (só o que o layout lê: id, type, content, children).
function bloco(id: string, texto: string, filhos: Block[] = []): Block {
  return {
    id,
    type: 'bulletListItem',
    content: [{ type: 'text', text: texto, styles: {} }],
    children: filhos,
    props: {},
    // biome-ignore lint/suspicious/noExplicitAny: mock parcial p/ teste de layout
  } as any;
}

const handlers = {
  onToggle: () => {},
  onToggleTarefa: () => {},
  onRenomear: () => {},
  onEdicao: () => {},
};

// altura aproximada de um nó a partir do rótulo, espelhando a estimativa do
// layout (linhas × ~18px + padding). Usada só pra afirmar que os nós não se
// encostam; não precisa ser exata, só uma cota inferior segura.
function alturaAprox(texto: string): number {
  const linhas = Math.min(Math.max(Math.ceil(texto.length / 30), 1), 4);
  return linhas * 18 + 20;
}

describe('layout do mapa — sem sobreposição de irmãos', () => {
  it('empilha irmãos multilinha sem encostar (modo horizontal)', () => {
    // um pai com filhos de tamanhos bem diferentes (1 a 3 linhas)
    const doc = [
      bloco('pai', 'Deca (Maquinas)', [
        bloco('f1', 'Receptivo'),
        bloco('f2', 'Não tem mais material suficiente (vendeu)'),
        bloco(
          'f3',
          'Melhor piçarra é com pedriscos (barro vermelho com pedra - fica proximo a ceramica iguatu - de 11 a 13km)',
        ),
        bloco('f4', '450 a reais (com a maquina inclusa)'),
      ]),
    ];

    const { nodes } = montarNosEArestas(
      doc,
      new Set(),
      null,
      ['#111', '#222', '#333'],
      'horizontal',
      null,
      new Map(),
      handlers,
    );

    // irmãos = todos menos o pai; ordenados pelo Y (eixo transversal do horizontal)
    const irmaos = ['f1', 'f2', 'f3', 'f4']
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is NonNullable<typeof n> => n != null)
      .sort((a, b) => a.position.y - b.position.y);

    expect(irmaos).toHaveLength(4);

    // a distância entre centros de irmãos vizinhos precisa ser ≥ meia altura de
    // cada um (senão as caixas se sobrepõem verticalmente)
    for (let i = 1; i < irmaos.length; i++) {
      const ant = irmaos[i - 1];
      const at = irmaos[i];
      if (!ant || !at) throw new Error('irmão faltando');
      const gap = at.position.y - ant.position.y;
      const minimo = alturaAprox(ant.data.label) / 2 + alturaAprox(at.data.label) / 2;
      expect(gap).toBeGreaterThanOrEqual(minimo);
    }
  });
});
