# Research 03 — Tech do mindmap: React Flow vs alternativas

Data: 2026-07-30 · Fontes: docs oficiais reactflow.dev, repos GitHub, markmap.js.org.

## Veredito

**Recomendação: React Flow (`@xyflow/react`) + layout `d3-hierarchy`/`d3-flextree` + hook de animação de posições.**
**Plano B: markmap (markdown→SVG) para um MVP rápido e read-only.**

É a mesma stack do produto de referência (logs `[ReactFlowMindmap]`), e todos os 7
requisitos têm caminho comprovado nos docs/exemplos oficiais. O único ponto de
atenção real é o requisito 7 (milhares de nós) — mitigável, detalhes abaixo.

---

## Licença e modelo de negócio do React Flow (evidência dura)

- **Core 100% MIT.** README oficial: "React Flow and Svelte Flow are MIT licensed"
  ([xyflow/xyflow](https://github.com/xyflow/xyflow), ~38k stars, v12 = `@xyflow/react`).
- **Pro NÃO destrava features.** O site afirma: "React Flow is open-source MIT-licensed
  software, and it will be forever". A assinatura ($169–289/mês) dá acesso a
  **Pro Examples/Templates, issues priorizadas e suporte direto** — nenhuma
  funcionalidade da lib é paga ([reactflow.dev/pro](https://reactflow.dev/pro)).
- Detalhe prático: o exemplo polido de **Expand & Collapse é um Pro Example**
  ([reactflow.dev/examples/layout/expand-collapse](https://reactflow.dev/examples/layout/expand-collapse)).
  A técnica em si é pública (hook `useExpandCollapse` sobre d3-hierarchy, alternando
  `hidden` dos nós) e há reimplementações comunitárias
  ([justinfernald/react-flow-tree-expand-collapse](https://github.com/justinfernald/react-flow-tree-expand-collapse)).
  Implementamos nós mesmos sem pagar nada.

## Layout automático NÃO é nativo — confirmado

Docs oficiais: "We have not implemented our own layouting solution yet"
([reactflow.dev/learn/layouting/layouting](https://reactflow.dev/learn/layouting/layouting)).
Opções recomendadas oficialmente:

| Lib | Avaliação oficial | Para nós |
|---|---|---|
| **dagre** | "If you need to organize your flows into a tree, we highly recommend dagre" | Boa, mas genérica (DAG) |
| **d3-hierarchy** | Ideal para árvore de raiz única; assume nós de tamanho uniforme | **Melhor fit** (mindmap = árvore de raiz única). `d3-flextree` resolve tamanhos variáveis |
| **elk** | "the most configurable" mas "its complexity makes it difficult... to support" | Overkill |
| d3-force | Física, não-árvore | Não se aplica |

Existe **tutorial oficial de mind map** ([reactflow.dev/learn/tutorials/mind-map-app-with-react-flow](https://reactflow.dev/learn/tutorials/mind-map-app-with-react-flow)) — prova o caso de uso, embora use posicionamento manual (nós vamos de layout automático).

## Os 7 requisitos no React Flow

1. **Layout de árvore horizontal re-executado a cada edição** — d3-hierarchy/flextree
   (raiz à esquerda = trocar x/y). Exemplo oficial "Dynamic Layouting" faz exatamente
   isso: recálculo de posições com transição suave a cada mudança
   ([reactflow.dev/examples/layout/dynamic-layouting](https://reactflow.dev/examples/layout/dynamic-layouting)).
2. **Colapsar/expandir com badge** — padrão `hidden` por subárvore (recomendação
   oficial de performance) + badge de contagem é só render do custom node. Técnica do
   Pro Example, reimplementável.
3. **Zoom por nível** — **confirmado na API**: `fitView({ nodes: [...], duration, padding })`
   aceita subconjunto de nós ("Fits the view based on the passed params. By default it
   fits the view to all nodes") + `fitBounds`/`zoomTo`/`setViewport` animáveis
   ([reactflow.dev/api-reference/types/react-flow-instance](https://reactflow.dev/api-reference/types/react-flow-instance)).
4. **Focus mode** — mesmo mecanismo de `hidden` + `fitView` no subconjunto. Trivial.
5. **Sincronia com editor** — React Flow é controlado (nodes/edges vêm do nosso estado
   Zustand); `onNodeClick` → linha do editor; seleção no editor → `selected` no nó +
   `fitView({nodes: [id]})`. Sem impedância.
6. **Pan/zoom infinito, +/−/fit, fullscreen** — core da lib (componente `<Controls/>`).
7. **Milhares de nós** — o ponto fraco. Ver abaixo.

### Animação de layout (nós deslizando)

Não é automática, mas há **exemplo oficial "Node Position Animation"**: hook
`useAnimatedNodes` que interpola posições (interpolação linear /
`requestAnimationFrame`; d3-interpolate serve igual)
([reactflow.dev/examples/nodes/node-position-animation](https://reactflow.dev/examples/nodes/node-position-animation)).
Pipeline: editor muda → recalcula layout → hook anima posições antigas→novas.
~40 linhas de código, padrão consolidado.

### Performance com milhares de nós — evidência

- Prop **`onlyRenderVisibleElements`** faz culling do viewport (virtualização).
- **Caveat 1 (issue aberta)**: "all nodes get rendered initially even if one uses
  onlyRenderVisibleElements" — render inicial não é virtualizado
  ([xyflow#3883](https://github.com/xyflow/xyflow/issues/3883), aberta, `topic:culling`).
- **Caveat 2**: zoom-out total torna tudo "visível" e anula o culling; a mitigação
  de mercado é **semantic zoom/LOD** — abaixo de certo zoom, trocar o custom node por
  placeholder leve ([visualflow.dev/blogs/scale-studio-pro](https://www.visualflow.dev/blogs/scale-studio-pro)).
- Guia oficial de performance: memoização rígida, não filtrar `nodes` em render, e
  **colapsar/esconder subárvores** como estratégia primária — que já é nosso
  requisito 2 ([reactflow.dev/learn/advanced-use/performance](https://reactflow.dev/learn/advanced-use/performance)).
- Prática relatada: centenas a ~2–3k nós visíveis fluem bem com memoização;
  10k+ todos montados quebra sem LOD. Como o mapa nasce colapsado por nível,
  o número de nós *montados* fica pequeno mesmo com documento gigante.

## Alternativas avaliadas honestamente

### markmap (MIT) — [markmap.js.org](https://markmap.js.org/)
- **A favor**: markdown→mindmap direto (casa com "texto é fonte da verdade");
  colapsar/expandir por clique, pan/zoom e fit nativos; leve; render em minutos.
- **Contra**: pensado para *visualização*, não para app interativo — API de eventos
  por nó e customização de render são limitadas (opções JSON são "a subset of the
  low-level options"); sem focus mode nativo; badge de contagem exigiria fork;
  sincronia bidirecional fina (req 5) e zoom-por-nível (req 3) viram gambiarra
  sobre SVG gerado. Reprova nos reqs 3, 4 e 5.
- **Papel**: excelente **plano B / MVP read-only** em 1 dia.

### mind-elixir (MIT) — [mind-elixir-core](https://github.com/SSShooter/mind-elixir-core)
- **A favor**: editor de mindmap completo, framework-agnostic, data-driven
  (`init/refresh/getData`), eventos (`selectNodes`, `expandNode`), leve.
- **Contra**: é um **editor com modelo de dados próprio** — nosso source of truth é o
  editor de texto; usar mind-elixir como "view burra" via `refresh(data)` briga com o
  design da lib (edição in-map, operações próprias) e o two-way binding vira fonte de
  conflito. Layout e visual menos customizáveis que custom nodes React.
- **Papel**: descartado — resolve o problema errado (queremos view, não segundo editor).

### SVG custom com d3 (d3-flextree + d3-zoom)
- **A favor**: controle total, performance máxima possível, zero dependência de terceiros.
- **Contra**: reimplementar do zero pan/zoom, seleção, hit-testing, controls,
  acessibilidade, animação — semanas de trabalho para chegar onde o React Flow já está.
- **Papel**: só se o React Flow provar não aguentar o "grande mapa" nem com LOD.

## Decisão e plano B

1. **React Flow + d3-hierarchy (ou d3-flextree) + `useAnimatedNodes`**. MIT, sem custo,
   stack idêntica à referência, 7/7 requisitos com caminho documentado.
2. **Mitigações do req 7 desde o dia 1**: subárvores colapsadas = `hidden` (nó nem
   monta), `onlyRenderVisibleElements`, memoização conforme guia oficial; semantic
   zoom/LOD fica para a fase do "grande mapa infinito".
3. **Plano B**: markmap para MVP read-only se precisarmos de algo na tela em 1 dia;
   d3 custom apenas como último recurso se o grande mapa estourar o React Flow.

## Fontes principais

- https://github.com/xyflow/xyflow (licença MIT, README)
- https://reactflow.dev/pro (modelo Pro = exemplos/suporte)
- https://reactflow.dev/learn/layouting/layouting (layout não-nativo; dagre/d3-hierarchy/elk)
- https://reactflow.dev/learn/tutorials/mind-map-app-with-react-flow (tutorial oficial de mind map)
- https://reactflow.dev/api-reference/types/react-flow-instance (`fitView` com `nodes` específicos)
- https://reactflow.dev/examples/nodes/node-position-animation (animação de posições)
- https://reactflow.dev/examples/layout/dynamic-layouting (re-layout com transição)
- https://reactflow.dev/examples/layout/expand-collapse (Pro Example; técnica pública)
- https://reactflow.dev/learn/advanced-use/performance (guia oficial de performance)
- https://github.com/xyflow/xyflow/issues/3883 (limite do onlyRenderVisibleElements)
- https://markmap.js.org/ · https://github.com/SSShooter/mind-elixir-core
