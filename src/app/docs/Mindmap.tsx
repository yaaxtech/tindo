'use client';

// RoadMapMind — mapa mental (React Flow) sincronizado com o editor outline.
// Portado do protótipo aprovado (ticket 06). Fatia 4: visualização + sincronia
// (layout tidy, colapso com badge, foco, zoom, clique nó → linha). A edição
// pelo mapa (criar/mover/renomear) chega na Fatia 5.

import type { Block } from '@blocknote/core';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
  nivel: number;
  raiz: boolean;
  tarefa: boolean;
  concluida: boolean;
  colapsado: boolean;
  descendentes: number;
  ativo: boolean;
  cor: string | undefined;
  orientacao: Orientacao;
  onToggle: (id: string) => void;
  onToggleTarefa: (id: string) => void;
};

type NoMapa = Node<NoData>;

const ROW_H = 56;
const COL_W = 300;
const ROW_V = 130; // altura por nível no modo vertical
const COL_V = 220; // largura por folha no modo vertical

type Handlers = {
  onToggle: (id: string) => void;
  onToggleTarefa: (id: string) => void;
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

  // linha vazia de LISTA continua no mapa (como "…") — senão o zoom pula ao criar
  // linha nova; só parágrafo vazio (a linha-fantasma do fim do doc) fica de fora
  const conta = (c: Block) => c.type !== 'paragraph' || extrairTexto(c).trim() !== '';
  const filhosVisiveis = (b: Block): Block[] =>
    colapsados.has(b.id) ? [] : (b.children ?? []).filter(conta);

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
        nivel: profundidade,
        raiz: profundidade === 0,
        tarefa: b.type === 'checkListItem',
        concluida: b.type === 'checkListItem' && b.props.checked === true,
        colapsado: colapsados.has(b.id),
        descendentes: contarDescendentes(b),
        ativo: ativo === b.id,
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
        nivel: 0,
        raiz: true,
        tarefa: false,
        concluida: false,
        colapsado: false,
        descendentes: topo.length,
        ativo: false,
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
  const horizontal = data.orientacao === 'horizontal';
  const virtual = id === RAIZ_ID;

  return (
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
      <span className="mm-label">{data.label}</span>
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
  aoClicarNo: (id: string) => void;
  aoToggleTarefa: (id: string) => void;
};

function MindmapInterno({
  doc,
  focoId,
  cursorId,
  cores,
  focoEdicao,
  orientacao,
  rotuloRaiz,
  aoClicarNo,
  aoToggleTarefa,
}: MindmapProps) {
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const { fitView } = useReactFlow();

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
      montarNosEArestas(base, colapsados, cursorId, cores, orientacao, focoId ? null : rotuloRaiz, {
        onToggle: alternar,
        onToggleTarefa: aoToggleTarefa,
      }),
    [base, colapsados, cursorId, cores, orientacao, focoId, rotuloRaiz, alternar, aoToggleTarefa],
  );

  // fitView do React Flow devolve uma Promise — rejeição silenciosa (animação
  // cancelada) vira "unhandled error" no Next se não for engolida
  const enquadrar = useCallback(
    (opts?: Parameters<typeof fitView>[0]) => {
      Promise.resolve(fitView(opts)).catch(() => {});
    },
    [fitView],
  );

  // Modo foco de edição: enquadra o nó atual + pai + filhas, seguindo o cursor.
  useEffect(() => {
    if (!focoEdicao || !cursorId) return;
    if (!nodes.some((n) => n.id === cursorId)) return; // nó ainda não existe no mapa — não pula
    const alvo = [{ id: cursorId }];
    const pai = pais.get(cursorId);
    if (pai) alvo.push({ id: pai });
    for (const f of filhos.get(cursorId) ?? []) alvo.push({ id: f });
    const t = setTimeout(() => enquadrar({ nodes: alvo, duration: 300, padding: 0.5 }), 60);
    return () => clearTimeout(t);
  }, [focoEdicao, cursorId, pais, filhos, nodes, enquadrar]);

  // Sem foco de edição: reenquadra suave a cada mudança de estrutura.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reenquadrar depende da contagem, não dos objetos
  useEffect(() => {
    if (focoEdicao) return;
    const t = setTimeout(() => enquadrar({ duration: 350, padding: 0.2 }), 60);
    return () => clearTimeout(t);
  }, [nodes.length, focoId, orientacao, focoEdicao, enquadrar]);

  return (
    <div className="mm-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={tiposDeNo}
        onNodeClick={(_, n) => {
          if (n.id !== RAIZ_ID) aoClicarNo(n.id);
        }}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        nodesDraggable={false}
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
    </div>
  );
}

export default function Mindmap(props: MindmapProps) {
  return (
    <ReactFlowProvider>
      <MindmapInterno {...props} />
    </ReactFlowProvider>
  );
}
