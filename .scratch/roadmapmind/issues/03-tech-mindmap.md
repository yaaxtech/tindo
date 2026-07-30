# 03 — Tech do mindmap (React Flow ou alternativa)

Type: research
Status: resolved
Blocked by: —

## Question

O produto de referência usa React Flow para o mindmap (confirmado por logs de console: `[ReactFlowMindmap] treeToFlowElements`). React Flow é a escolha certa para o nosso, ou existe opção melhor?

O mindmap precisa de:
1. Layout automático de árvore horizontal (raiz à esquerda, filhos à direita) que se refaz a cada edição do documento, com animação suave.
2. Colapsar/expandir nós, com badge de contagem de descendentes escondidos.
3. "Zoom por nível": ao navegar, o mapa enquadra automaticamente tudo que está naquele nível (fit-to-view do subnível).
4. Focus mode: focar um nó e seus descendentes, escondendo o resto.
5. Sincronia bidirecional com o editor: selecionar linha destaca nó; clicar nó leva à linha.
6. Pan/zoom infinito com +/−/fit; fullscreen do painel.
7. Futuro: o "grande mapa infinito" — navegar o documento-raiz inteiro (milhares de nós) com zoom contínuo → performance com virtualização importa.

Avaliar: React Flow (@xyflow/react) + layout (dagre/d3-hierarchy/elk), markmap, mind-elixir, ou SVG custom com d3. Verificar licenças (React Flow é MIT? recursos pro pagos?) e limites de performance com milhares de nós.

Entregável: recomendação única com evidência + plano B.

## Answer

**Recomendação: React Flow (`@xyflow/react`) + d3-hierarchy/d3-flextree + hook de animação de posições.**
Core é MIT para sempre; Pro é só exemplos/suporte, nenhuma feature paga. Layout automático não é
nativo — docs oficiais recomendam d3-hierarchy para árvore de raiz única (nosso caso); re-layout
animado tem exemplo oficial (Dynamic Layouting + Node Position Animation). `fitView` aceita subconjunto
de nós → resolve zoom-por-nível e focus mode; collapse via `hidden` + badge no custom node (técnica do
Pro Example, reimplementável de graça). Sincronia com editor é natural (lib controlada por estado).
Risco: milhares de nós — `onlyRenderVisibleElements` não virtualiza o render inicial (issue #3883) e
zoom-out anula o culling → mitigar com subárvores colapsadas desde o dia 1 e semantic zoom/LOD na fase
do grande mapa. Plano B: markmap (MVP read-only em 1 dia); mind-elixir descartado (é um segundo editor,
briga com texto-como-fonte-da-verdade). Detalhes e fontes: `.scratch/roadmapmind/research/03-tech-mindmap.md`.
