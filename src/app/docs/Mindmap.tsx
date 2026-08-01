'use client';

// RoadMapMind — mapa mental (React Flow) sincronizado com o editor outline.
// Portado do protótipo aprovado (ticket 06). Fatia 4: visualização + sincronia.
// Fatia 5: edição pelo mapa — inline no nó (duplo clique), menu de ações com
// atalhos (Enter filha · Shift+Enter irmã · Delete excluir) e arrastar para
// re-plugar em outra mãe (com validação de ciclo no shell).

import type { Block } from '@blocknote/core';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { GitMerge } from 'lucide-react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Orientacao } from './useDocStore';

export const RAIZ_ID = '__raiz__';

// ---------------------------------------------------------------------------

export function extrairTexto(block: Block): string {
  if (!Array.isArray(block.content)) return '';
  return block.content
    .map((i) => ('text' in i && typeof i.text === 'string' ? i.text : ''))
    .join('');
}

function contarDescendentes(block: Block): number {
  let n = block.children?.length ?? 0;
  for (const c of block.children ?? []) n += contarDescendentes(c);
  return n;
}

// mesma paleta das guias do editor (nível 1 em diante) — default "automático"
export const CORES_NIVEL = [
  'rgba(110, 155, 220, 0.9)', // azul-acinzentado
  'rgba(210, 170, 115, 0.9)', // areia/taupe
  'rgba(120, 190, 150, 0.9)', // verde-sálvia
  'rgba(180, 140, 210, 0.9)', // lilás-cinza
  'rgba(220, 140, 145, 0.9)', // rosé-cinza
];

type NoData = {
  label: string;
  editarInicial: boolean;
  nivel: number;
  raiz: boolean;
  tarefa: boolean;
  concluida: boolean;
  colapsado: boolean;
  descendentes: number;
  ativo: boolean;
  multiplosPais: boolean;
  cor: string | undefined;
  orientacao: Orientacao;
  onToggle: (id: string) => void;
  onToggleTarefa: (id: string) => void;
  onRenomear: (id: string, texto: string) => void;
  onEdicao: (editando: boolean) => void;
};

type NoMapa = Node<NoData>;

const ROW_H = 56;
const COL_W = 300;
const ROW_V = 130; // altura por nível no modo vertical
const COL_V = 220; // largura por folha no modo vertical

type Handlers = {
  onToggle: (id: string) => void;
  onToggleTarefa: (id: string) => void;
  onRenomear: (id: string, texto: string) => void;
  onEdicao: (editando: boolean) => void;
};

// Layout tidy simples: folhas empilhadas, pai centralizado nos filhos.
// `rotuloRaiz`: quando o mapa mostra o documento inteiro, cria um nó-raiz
// virtual (o nome do usuário) amarrando os itens de primeiro nível.
function montarNosEArestas(
  blocks: Block[],
  colapsados: Set<string>,
  ativo: string | null,
  cores: string[],
  orientacao: Orientacao,
  rotuloRaiz: string | null,
  espelhos: Map<string, string>,
  handlers: Handlers,
): {
  nodes: NoMapa[];
  edges: { id: string; source: string; target: string; style?: React.CSSProperties }[];
  pais: Map<string, string>;
  filhos: Map<string, string[]>;
} {
  const nodes: NoMapa[] = [];
  const edges: { id: string; source: string; target: string; style?: React.CSSProperties }[] = [];
  const pais = new Map<string, string>();
  const filhos = new Map<string, string[]>();
  const base = rotuloRaiz ? 1 : 0; // com raiz virtual, conteúdo começa no nível 1
  const originaisEspelhados = new Set(espelhos.values());

  // linha vazia de LISTA continua no mapa (como "…") — senão o zoom pula ao criar
  // linha nova; só parágrafo vazio (a linha-fantasma do fim do doc) fica de fora
  const conta = (c: Block) => c.type !== 'paragraph' || extrairTexto(c).trim() !== '';
  // espelhos NÃO viram nó próprio — viram uma 2ª aresta apontando pro nó original
  const filhosVisiveis = (b: Block): Block[] =>
    colapsados.has(b.id) ? [] : (b.children ?? []).filter((c) => conta(c) && !espelhos.has(c.id));
  const filhosEspelho = (b: Block): Block[] =>
    colapsados.has(b.id) ? [] : (b.children ?? []).filter((c) => espelhos.has(c.id));

  function folhas(b: Block): number {
    const fs = filhosVisiveis(b);
    if (fs.length === 0) return 1;
    let n = 0;
    for (const f of fs) n += folhas(f);
    return n;
  }

  function posicaoDe(profundidade: number, centro: number) {
    return orientacao === 'horizontal'
      ? { x: profundidade * COL_W, y: centro * ROW_H }
      : { x: centro * COL_V, y: profundidade * ROW_V };
  }

  function visita(b: Block, profundidade: number, offset: number): number {
    const fs = filhosVisiveis(b);
    const altura = folhas(b);
    const cor = profundidade === base ? undefined : cores[(profundidade - base - 1) % cores.length];
    nodes.push({
      id: b.id,
      type: 'linha',
      position: posicaoDe(profundidade, offset + altura / 2),
      data: {
        label: extrairTexto(b) || '…',
        editarInicial: false,
        nivel: profundidade,
        raiz: profundidade === 0,
        tarefa: b.type === 'checkListItem',
        concluida: b.type === 'checkListItem' && b.props.checked === true,
        colapsado: colapsados.has(b.id),
        descendentes: contarDescendentes(b),
        ativo: ativo === b.id,
        multiplosPais: originaisEspelhados.has(b.id),
        cor,
        orientacao,
        ...handlers,
      },
    });
    let off = offset;
    filhos.set(
      b.id,
      fs.map((f) => f.id),
    );
    // aresta pontilhada da mãe-espelho direto pro nó ORIGINAL (um nó, duas mães)
    for (const esp of filhosEspelho(b)) {
      const origId = espelhos.get(esp.id);
      if (origId) {
        edges.push({
          id: `${b.id}~${origId}`,
          source: b.id,
          target: origId,
          style: { stroke: 'rgba(44, 175, 147, 0.8)', strokeDasharray: '6 4', opacity: 0.8 },
        });
      }
    }
    for (const f of fs) {
      pais.set(f.id, b.id);
      const corAresta = cores[(profundidade - base) % cores.length] ?? cores[0];
      edges.push({
        id: `${b.id}-${f.id}`,
        source: b.id,
        target: f.id,
        style: { stroke: corAresta, opacity: 0.55 },
      });
      off = visita(f, profundidade + 1, off);
    }
    return offset + altura;
  }

  const topo = blocks.filter(conta);
  let off = 0;
  for (const b of topo) off = visita(b, base, off);

  if (rotuloRaiz) {
    nodes.push({
      id: RAIZ_ID,
      type: 'linha',
      position: posicaoDe(0, off / 2),
      data: {
        label: rotuloRaiz,
        editarInicial: false,
        nivel: 0,
        raiz: true,
        tarefa: false,
        concluida: false,
        colapsado: false,
        descendentes: topo.length,
        ativo: false,
        multiplosPais: false,
        cor: undefined,
        orientacao,
        ...handlers,
      },
    });
    for (const b of topo) {
      pais.set(b.id, RAIZ_ID);
      edges.push({
        id: `${RAIZ_ID}-${b.id}`,
        source: RAIZ_ID,
        target: b.id,
        style: { stroke: 'rgba(44, 175, 147, 0.6)', opacity: 0.7 },
      });
    }
    filhos.set(
      RAIZ_ID,
      topo.map((b) => b.id),
    );
  }

  // arestas cujo alvo/fonte não está no mapa (ex.: fora do foco) são descartadas
  const idsNoMapa = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: edges.filter((e) => idsNoMapa.has(e.source) && idsNoMapa.has(e.target)),
    pais,
    filhos,
  };
}

// ---------------------------------------------------------------------------

const NoLinha = memo(function NoLinha({ id, data }: NodeProps<NoMapa>) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(data.label);
  const horizontal = data.orientacao === 'horizontal';
  const virtual = id === RAIZ_ID;

  // avisa o mapa quando entra/sai da edição (bloqueia menu e mostra a dica)
  const trocarEdicao = (v: boolean) => {
    setEditando(v);
    data.onEdicao(v);
  };

  // nó recém-criado pelo menu/atalho já nasce em modo de edição (pra nomear direto)
  // biome-ignore lint/correctness/useExhaustiveDependencies: dispara só na criação
  useEffect(() => {
    if (data.editarInicial) {
      setTexto(data.label);
      setEditando(true);
      data.onEdicao(true);
    }
  }, [data.editarInicial]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: interações de teclado vivem no mapa (atalhos)
    <div
      className={[
        'mm-no',
        data.raiz ? 'mm-no-raiz' : '',
        data.tarefa ? 'mm-no-tarefa' : '',
        data.concluida ? 'mm-no-concluida' : '',
        data.ativo ? 'mm-no-ativo' : '',
      ].join(' ')}
      style={
        data.cor ? { borderColor: data.cor, boxShadow: `inset 3px 0 0 ${data.cor}` } : undefined
      }
      onDoubleClick={(e) => {
        if (virtual) return;
        e.stopPropagation();
        setTexto(data.label);
        trocarEdicao(true);
      }}
      onClick={(e) => {
        // durante a edição, cliques não abrem o menu de ações
        if (editando) e.stopPropagation();
      }}
      onContextMenu={(e) => {
        if (editando) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <Handle
        type="target"
        position={horizontal ? Position.Left : Position.Top}
        className="mm-handle"
      />
      {data.tarefa && (
        <input
          type="checkbox"
          className="mm-checkbox"
          checked={data.concluida}
          onChange={() => data.onToggleTarefa(id)}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {data.multiplosPais && (
        <GitMerge
          aria-label="Este item aparece em mais de um ramo"
          className="mm-relacao-multipla"
          size={13}
          strokeWidth={2.2}
        />
      )}
      {editando ? (
        <textarea
          className="mm-input"
          value={texto}
          rows={Math.max(1, texto.split('\n').length)}
          // biome-ignore lint/a11y/noAutofocus: campo só existe durante a edição
          autoFocus
          onFocus={(e) => e.target.select()}
          onChange={(e) => setTexto(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              // Enter salva; Shift+Enter pula linha dentro do nó
              e.preventDefault();
              data.onRenomear(id, texto);
              trocarEdicao(false);
            }
            if (e.key === 'Escape') trocarEdicao(false);
          }}
          onBlur={() => {
            data.onRenomear(id, texto);
            trocarEdicao(false);
          }}
        />
      ) : (
        <span className="mm-label">{data.label}</span>
      )}
      {!virtual && data.descendentes > 0 && (
        <button
          type="button"
          className={`mm-toggle ${data.colapsado ? 'mm-toggle-fechado' : ''} ${horizontal ? '' : 'mm-toggle-v'}`}
          title={data.colapsado ? `Expandir (${data.descendentes} dentro)` : 'Recolher ramo'}
          onClick={(e) => {
            e.stopPropagation();
            data.onToggle(id);
          }}
        >
          {data.colapsado ? data.descendentes : horizontal ? '‹' : '︿'}
        </button>
      )}
      <Handle
        type="source"
        position={horizontal ? Position.Right : Position.Bottom}
        className="mm-handle"
      />
    </div>
  );
});

const tiposDeNo = { linha: NoLinha };

// ---------------------------------------------------------------------------

function acharSubarvore(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    const achado = acharSubarvore(b.children ?? [], id);
    if (achado) return achado;
  }
  return null;
}

export type MindmapProps = {
  doc: Block[];
  focoId: string | null;
  cursorId: string | null;
  cores: string[];
  focoEdicao: boolean;
  orientacao: Orientacao;
  rotuloRaiz: string;
  editarNoId: string | null;
  aoFimEdicaoNo: () => void;
  aoClicarNo: (id: string) => void;
  aoToggleTarefa: (id: string) => void;
  aoAdicionarFilho: (id: string) => void;
  aoAdicionarIrma: (id: string) => void;
  aoExcluir: (id: string) => void;
  aoRenomear: (id: string, texto: string) => void;
  aoReplugar: (id: string, novoPaiId: string) => void;
  aoEspelhar: (id: string, novaMaeId: string) => void;
  espelhos: Map<string, string>; // espelhoBlockId -> linhaOriginalId
};

/** Exposto via ref — o botão de exportar PDF fica na topbar (RoadMapMind.tsx),
 * fora do mapa; ele chama isto pra pegar o PNG do mapa inteiro. */
export interface MindmapHandle {
  exportarComoPng: () => Promise<{ dataUrl: string; fundo: string }>;
}

type MenuCtx = { id: string; x: number; y: number };

const MindmapInterno = forwardRef<MindmapHandle, MindmapProps>(function MindmapInterno(
  {
    doc,
    focoId,
    cursorId,
    cores,
    focoEdicao,
    orientacao,
    rotuloRaiz,
    editarNoId,
    aoFimEdicaoNo,
    aoClicarNo,
    aoToggleTarefa,
    aoAdicionarFilho,
    aoAdicionarIrma,
    aoExcluir,
    aoRenomear,
    aoReplugar,
    aoEspelhar,
    espelhos,
  },
  ref,
) {
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const [manuais, setManuais] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [menu, setMenu] = useState<MenuCtx | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [emEdicao, setEmEdicao] = useState(false);
  const mapaRef = useRef<HTMLDivElement>(null);
  const { fitView, getNodes } = useReactFlow();

  // Captura o mapa INTEIRO (não só a área visível) como PNG — padrão oficial
  // do React Flow: recalcula o enquadramento pelos bounds de todos os nós
  // (getNodesBounds/getViewportForBounds) e rasteriza só o viewport nesse
  // enquadramento, sem afetar o zoom/pan que o usuário está vendo na tela.
  useImperativeHandle(
    ref,
    () => ({
      exportarComoPng: async () => {
        const nos = getNodes();
        if (nos.length === 0) return Promise.reject(new Error('O mapa está vazio.'));
        const bounds = getNodesBounds(nos);
        const vertical = orientacao === 'vertical';
        const largura = vertical ? 800 : 1200;
        const altura = vertical ? 1200 : 800;
        const viewport = getViewportForBounds(bounds, largura, altura, 0.2, 2, 0.12);
        const fluxo = mapaRef.current?.querySelector('.react-flow') as HTMLElement | null;
        const camada = mapaRef.current?.querySelector(
          '.react-flow__viewport',
        ) as HTMLElement | null;
        if (!fluxo || !camada) return Promise.reject(new Error('Mapa não encontrado.'));
        const raiz = mapaRef.current?.closest('.rmm-root');
        const temaEscuroAntes = raiz?.classList.contains('rmm-tema-dark') ?? false;
        const temaClaroAntes = raiz?.classList.contains('rmm-tema-light') ?? false;
        raiz?.classList.remove('rmm-tema-dark');
        raiz?.classList.add('rmm-tema-light');
        const fundo = '#ffffff';
        const transformAnterior = camada.style.transform;
        camada.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
        // timeout de segurança: a lib percorre todas as folhas de estilo da
        // página, e alguma fonte/CSS remoto lento trava a promise sem nunca
        // resolver nem rejeitar — nunca deixar o botão preso pra sempre
        try {
          await new Promise<void>((resolver) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolver())),
          );
          const dataUrl = await Promise.race([
            toPng(fluxo, {
              backgroundColor: fundo,
              cacheBust: true,
              width: largura,
              height: altura,
              pixelRatio: 1.5,
              skipFonts: true,
              filter: (no) => {
                const classes = (no as Element).classList;
                // A grade pertence ao editor; o PDF mostra só o mapa em fundo branco.
                return (
                  !classes?.contains('react-flow__controls') &&
                  !classes?.contains('react-flow__background') &&
                  !classes?.contains('mm-dica')
                );
              },
              style: {
                width: `${largura}px`,
                height: `${altura}px`,
              },
            }),
            new Promise<never>((_, rejeitar) =>
              setTimeout(
                () => rejeitar(new Error('Tempo esgotado ao gerar a imagem do mapa.')),
                15000,
              ),
            ),
          ]);
          return { dataUrl, fundo };
        } finally {
          camada.style.transform = transformAnterior;
          if (!temaClaroAntes) raiz?.classList.remove('rmm-tema-light');
          if (temaEscuroAntes) raiz?.classList.add('rmm-tema-dark');
        }
      },
    }),
    [getNodes, orientacao],
  );

  // atalhos com nó selecionado: Delete exclui · Enter cria filha · Shift+Enter cria irmã
  useEffect(() => {
    if (!selecionado) return;
    const handler = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selecionado !== RAIZ_ID) aoExcluir(selecionado);
        setMenu(null);
        setSelecionado(null);
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        aoAdicionarIrma(selecionado);
        setMenu(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        aoAdicionarFilho(selecionado);
        setMenu(null);
      } else if (e.key === 'Escape') {
        setMenu(null);
        setSelecionado(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selecionado, aoExcluir, aoAdicionarFilho, aoAdicionarIrma]);

  const alternar = useCallback((id: string) => {
    setColapsados((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);

  const base = useMemo(() => {
    if (focoId) {
      const sub = acharSubarvore(doc, focoId);
      if (sub) return [sub];
    }
    return doc;
  }, [doc, focoId]);

  const { nodes, edges, pais, filhos } = useMemo(
    () =>
      montarNosEArestas(
        base,
        colapsados,
        cursorId,
        cores,
        orientacao,
        focoId ? null : rotuloRaiz,
        espelhos,
        {
          onToggle: alternar,
          onToggleTarefa: aoToggleTarefa,
          onRenomear: (id, texto) => {
            aoRenomear(id, texto);
            aoFimEdicaoNo();
          },
          onEdicao: (v) => {
            setEmEdicao(v);
            if (v) setMenu(null); // edição aberta = menu some
          },
        },
      ),
    [
      base,
      colapsados,
      cursorId,
      cores,
      orientacao,
      focoId,
      rotuloRaiz,
      espelhos,
      alternar,
      aoToggleTarefa,
      aoRenomear,
      aoFimEdicaoNo,
    ],
  );

  const [alvoDrop, setAlvoDrop] = useState<string | null>(null);

  // posições manuais (nó arrastado fica onde o dono soltou) + flags visuais
  const nodesFinais = useMemo(
    () =>
      nodes.map((n) => {
        const manual = manuais.get(n.id);
        const extra: Partial<NoMapa> = {};
        if (manual) extra.position = manual;
        const classes: string[] = [];
        if (n.id === alvoDrop) classes.push('mm-alvo');
        if (n.id === selecionado) classes.push('mm-sel');
        // nó original que TEM espelhos ganha borda tracejada + indicador de junção
        if ([...espelhos.values()].includes(n.id)) classes.push('mm-espelho');
        if (classes.length) extra.className = classes.join(' ');
        if (n.id === editarNoId) extra.data = { ...n.data, editarInicial: true };
        return { ...n, ...extra };
      }),
    [nodes, manuais, alvoDrop, editarNoId, selecionado, espelhos],
  );

  const [nosEstado, setNosEstado] = useState<NoMapa[]>(nodesFinais);
  useEffect(() => setNosEstado(nodesFinais), [nodesFinais]);

  const aoSoltarNo = useCallback(
    (no: NoMapa, comAlt: boolean) => {
      if (no.id === RAIZ_ID) return;
      // perto de outro nó (raio 100px) = re-plugar (ou espelhar, com Alt) como filho dele
      let alvo: NoMapa | null = null;
      let menor = 100;
      for (const outro of nosEstado) {
        if (outro.id === no.id) continue;
        const d = Math.hypot(outro.position.x - no.position.x, outro.position.y - no.position.y);
        if (d < menor) {
          menor = d;
          alvo = outro;
        }
      }
      if (alvo) {
        setManuais((m) => {
          const novo = new Map(m);
          novo.delete(no.id);
          return novo;
        });
        if (comAlt) aoEspelhar(no.id, alvo.id);
        else aoReplugar(no.id, alvo.id);
      } else {
        // longe de tudo: fica onde soltou (modo manual)
        setManuais((m) => new Map(m).set(no.id, { ...no.position }));
      }
    },
    [nosEstado, aoReplugar, aoEspelhar],
  );

  // fitView do React Flow devolve uma Promise — rejeição silenciosa (animação
  // cancelada) vira "unhandled error" no Next se não for engolida
  const enquadrar = useCallback(
    (opts?: Parameters<typeof fitView>[0]) => {
      Promise.resolve(fitView(opts)).catch(() => {});
    },
    [fitView],
  );

  // Nó recém-criado (filha/irmã): zoom NELE + na mãe, já selecionado em destaque.
  useEffect(() => {
    if (!editarNoId) return;
    if (!nodes.some((n) => n.id === editarNoId)) return;
    setSelecionado(editarNoId);
    setMenu(null);
    const alvo = [{ id: editarNoId }];
    const pai = pais.get(editarNoId);
    if (pai) alvo.push({ id: pai });
    const t = setTimeout(() => enquadrar({ nodes: alvo, duration: 300, padding: 0.5 }), 80);
    return () => clearTimeout(t);
  }, [editarNoId, nodes, pais, enquadrar]);

  // Modo foco de edição: enquadra o nó atual + pai + filhas, seguindo o cursor.
  useEffect(() => {
    if (!focoEdicao || !cursorId || editarNoId) return;
    if (!nodes.some((n) => n.id === cursorId)) return; // nó ainda não existe no mapa — não pula
    const alvo = [{ id: cursorId }];
    const pai = pais.get(cursorId);
    if (pai) alvo.push({ id: pai });
    for (const f of filhos.get(cursorId) ?? []) alvo.push({ id: f });
    const t = setTimeout(() => enquadrar({ nodes: alvo, duration: 300, padding: 0.5 }), 60);
    return () => clearTimeout(t);
  }, [focoEdicao, cursorId, editarNoId, pais, filhos, nodes, enquadrar]);

  // Sem foco de edição: reenquadra suave a cada mudança de estrutura —
  // exceto quando um nó novo acabou de nascer (o zoom vai pra ele, não pro todo).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reenquadrar depende da contagem, não dos objetos
  useEffect(() => {
    if (focoEdicao || editarNoId) return;
    const t = setTimeout(() => enquadrar({ duration: 350, padding: 0.2 }), 60);
    return () => clearTimeout(t);
  }, [nodes.length, focoId, orientacao, focoEdicao, editarNoId, enquadrar]);

  return (
    <div ref={mapaRef} className="mm-wrap">
      <ReactFlow
        nodes={nosEstado}
        edges={edges}
        nodeTypes={tiposDeNo}
        onNodeClick={(_, n) => {
          if (emEdicao) return;
          // clique esquerdo: SÓ seleciona (atalhos valem) e mostra a linha no editor
          setMenu(null);
          setSelecionado(n.id);
          if (n.id !== RAIZ_ID) aoClicarNo(n.id);
        }}
        onNodeContextMenu={(e, n) => {
          e.preventDefault();
          if (emEdicao) return; // editando: nada de menu
          setSelecionado(n.id);
          const rect = (e.currentTarget as HTMLElement)
            .closest('.mm-wrap')
            ?.getBoundingClientRect();
          setMenu({
            id: n.id,
            x: e.clientX - (rect?.left ?? 0),
            y: e.clientY - (rect?.top ?? 0),
          });
        }}
        onPaneClick={() => {
          setMenu(null);
          setSelecionado(null);
        }}
        onNodeDoubleClick={() => setMenu(null)}
        onNodesChange={(mudancas: NodeChange<NoMapa>[]) =>
          setNosEstado((ns) => applyNodeChanges(mudancas, ns))
        }
        onNodeDrag={(_, n) => {
          // realça a mãe que vai receber o nó se soltar agora
          let alvo: string | null = null;
          let menor = 100;
          for (const outro of nosEstado) {
            if (outro.id === n.id) continue;
            const d = Math.hypot(outro.position.x - n.position.x, outro.position.y - n.position.y);
            if (d < menor) {
              menor = d;
              alvo = outro.id;
            }
          }
          setAlvoDrop(alvo);
        }}
        onNodeDragStop={(e, n) => {
          setAlvoDrop(null);
          aoSoltarNo(n as NoMapa, e.altKey);
        }}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        nodesDraggable
        nodesConnectable={false}
        defaultEdgeOptions={{ type: 'bezier' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(122,135,150,0.15)"
        />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>

      {emEdicao ? (
        <div className="mm-dica">Enter: salvar · Shift+Enter: pular linha · Esc: cancelar</div>
      ) : selecionado && selecionado !== RAIZ_ID ? (
        <div className="mm-dica">
          arraste: mudar de mãe · Alt (⌥) + arraste: ligar a 2ª mãe · Enter: filha · Shift+Enter:
          irmã · Delete: excluir
        </div>
      ) : null}

      {menu && (
        <div className="mm-menu" style={{ left: menu.x, top: menu.y }}>
          <button
            type="button"
            onClick={() => {
              aoAdicionarFilho(menu.id);
              setMenu(null);
            }}
          >
            ＋ Adicionar filha <kbd>Enter</kbd>
          </button>
          {menu.id !== RAIZ_ID && (
            <button
              type="button"
              onClick={() => {
                aoAdicionarIrma(menu.id);
                setMenu(null);
              }}
            >
              ⁙ Adicionar irmã <kbd>Shift+Enter</kbd>
            </button>
          )}
          {menu.id !== RAIZ_ID && (
            <button
              type="button"
              onClick={() => {
                aoExcluir(menu.id);
                setMenu(null);
              }}
            >
              🗑 Excluir nó <kbd>Delete</kbd>
            </button>
          )}
          {manuais.has(menu.id) && (
            <button
              type="button"
              onClick={() => {
                setManuais((m) => {
                  const novo = new Map(m);
                  novo.delete(menu.id);
                  return novo;
                });
                setMenu(null);
              }}
            >
              ↩ Este nó de volta ao lugar
            </button>
          )}
          {(() => {
            // reorganiza SÓ as filhas (descendentes) deste nó que foram movidas na mão
            const descendentes: string[] = [];
            const fila = [...(filhos.get(menu.id) ?? [])];
            while (fila.length) {
              const f = fila.pop();
              if (!f) break;
              descendentes.push(f);
              fila.push(...(filhos.get(f) ?? []));
            }
            const movidas = descendentes.filter((d) => manuais.has(d));
            if (movidas.length === 0) return null;
            return (
              <button
                type="button"
                onClick={() => {
                  setManuais((m) => {
                    const novo = new Map(m);
                    for (const d of movidas) novo.delete(d);
                    return novo;
                  });
                  setMenu(null);
                }}
              >
                ↺ Reorganizar as filhas deste nó ({movidas.length} movida
                {movidas.length > 1 ? 's' : ''})
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
});

const Mindmap = forwardRef<MindmapHandle, MindmapProps>(function Mindmap(props, ref) {
  return (
    <ReactFlowProvider>
      <MindmapInterno {...props} ref={ref} />
    </ReactFlowProvider>
  );
});

export default Mindmap;
