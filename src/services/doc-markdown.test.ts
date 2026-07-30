import { describe, expect, it } from 'vitest';
import { blocosParaLinhas, derivarTextoMd, linhasParaBlocos } from './doc-markdown';

const RAIZ = 'raiz-uuid';

// Blocos no formato BlockNote (árvore aninhada). props/content mínimos.
const blocosExemplo = [
  {
    id: 'a',
    type: 'bulletListItem',
    props: {},
    content: [{ type: 'text', text: 'Campanha', styles: {} }],
    children: [
      {
        id: 'b',
        type: 'checkListItem',
        props: { checked: false },
        content: [{ type: 'text', text: 'Post', styles: {} }],
        children: [
          {
            id: 'c',
            type: 'checkListItem',
            props: { checked: true },
            content: [{ type: 'text', text: 'Legenda', styles: {} }],
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: 'd',
    type: 'numberedListItem',
    props: {},
    content: [{ type: 'text', text: 'Site', styles: {} }],
    children: [],
  },
  { id: 'e', type: 'paragraph', props: {}, content: [], children: [] },
];

describe('blocosParaLinhas', () => {
  it('achata a árvore preservando id, pai e ordem', () => {
    const linhas = blocosParaLinhas(blocosExemplo, RAIZ);
    expect(linhas).toHaveLength(4);
    const byId = new Map(linhas.map((l) => [l.id, l]));
    expect(byId.get('a')?.paiId).toBe(RAIZ);
    expect(byId.get('b')?.paiId).toBe('a');
    expect(byId.get('c')?.paiId).toBe('b');
    expect(byId.get('d')?.paiId).toBe(RAIZ);
    // 'e' está vazio → não vira linha (linhas vazias de topo são descartadas)
    expect(byId.has('e')).toBe(false);
  });

  it('deriva tipo, tarefa_estado e modo_lista', () => {
    const byId = new Map(blocosParaLinhas(blocosExemplo, RAIZ).map((l) => [l.id, l]));
    expect(byId.get('a')?.tipo).toBe('texto');
    expect(byId.get('a')?.modoLista).toBe('marcadores');
    expect(byId.get('b')?.tipo).toBe('tarefa');
    expect(byId.get('b')?.tarefaEstado).toBe('aberta');
    expect(byId.get('c')?.tarefaEstado).toBe('concluida');
    expect(byId.get('d')?.modoLista).toBe('numeros');
  });

  it('ordem fracional mantém a sequência dos irmãos (ordenável por string)', () => {
    const linhas = blocosParaLinhas(blocosExemplo, RAIZ);
    const topo = linhas
      .filter((l) => l.paiId === RAIZ)
      .sort((x, y) => (x.ordem < y.ordem ? -1 : 1));
    expect(topo.map((l) => l.id)).toEqual(['a', 'd']);
  });
});

describe('round-trip blocos ↔ linhas', () => {
  it('linhasParaBlocos reconstrói a mesma árvore (id, type, aninhamento, checked)', () => {
    const linhas = blocosParaLinhas(blocosExemplo, RAIZ);
    const blocos = linhasParaBlocos(linhas, RAIZ);
    // remove o paragraph vazio 'e' do esperado (foi descartado)
    const simplifica = (
      bs: {
        id: string;
        type: string;
        props?: { checked?: boolean };
        content?: unknown;
        children?: unknown[];
      }[],
    ): unknown =>
      bs.map((b) => ({
        id: b.id,
        type: b.type,
        checked: b.type === 'checkListItem' ? (b.props?.checked ?? false) : undefined,
        content: b.content,
        children: simplifica((b.children ?? []) as typeof bs),
      }));
    expect(simplifica(blocos as never)).toEqual(simplifica(blocosExemplo.slice(0, 2) as never));
  });
});

describe('derivarTextoMd', () => {
  it('concatena o texto plano do inline content (sem prefixo — o prefixo é do SQL)', () => {
    expect(
      derivarTextoMd([
        { type: 'text', text: 'Oi ', styles: {} },
        { type: 'text', text: 'mundo', styles: { bold: true } },
      ]),
    ).toBe('Oi mundo');
  });
  it('conteúdo vazio vira string vazia', () => {
    expect(derivarTextoMd([])).toBe('');
  });
});

describe('espelhos (Fatia 7)', () => {
  const linhasBase = blocosParaLinhas(blocosExemplo, RAIZ);
  // espelho da linha 'c' (Legenda) aparecendo também sob 'd' (Site)
  const espelhos = [{ id: 'esp-1', linhaId: 'c', maeId: 'd', ordem: 'a0' }];

  it('linhasParaBlocos materializa o espelho sob a mãe, com o conteúdo do original e sem filhos', () => {
    const blocos = linhasParaBlocos(linhasBase, RAIZ, espelhos);
    const d = blocos.find((b) => b.id === 'd');
    expect(d?.children).toHaveLength(1);
    const esp = d?.children?.[0];
    expect(esp?.id).toBe('esp-1');
    expect(esp?.type).toBe('checkListItem');
    expect(esp?.content).toEqual([{ type: 'text', text: 'Legenda', styles: {} }]);
    expect(esp?.children ?? []).toHaveLength(0);
  });

  it('blocosParaLinhas IGNORA blocos-espelho (não viram linha própria)', () => {
    const blocos = linhasParaBlocos(linhasBase, RAIZ, espelhos);
    const linhas = blocosParaLinhas(blocos as never, RAIZ, new Set(['esp-1']));
    expect(linhas.find((l) => l.id === 'esp-1')).toBeUndefined();
    // e as linhas reais continuam todas lá
    expect(linhas.map((l) => l.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
