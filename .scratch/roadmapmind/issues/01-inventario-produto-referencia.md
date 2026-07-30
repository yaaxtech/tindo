# 01 — Inventário funcional do notepad de referência

Type: research
Status: resolved
Blocked by: —

## Question

O dono quer paridade funcional ("igual, com todas as funções e mais algumas") com o notepad do vídeo https://www.youtube.com/watch?v=62WpD75vnWE. Qual é o inventário COMPLETO de botões, atalhos e comportamentos desse produto?

Entregável: um inventário funcional em markdown (tabela: elemento → o que faz → prioridade MVP sim/não) que servirá de contrato de paridade para os protótipos (05, 06) e a spec (08).

Fontes: transcrição/descrição do vídeo (buscar transcript no YouTube) + o inventário parcial abaixo, extraído de 5 screenshots pelo cérebro da sessão de mapeamento.

## Contexto — o que já foi observado nos screenshots

**Topbar (esq→dir):** ícone home · toggle da sidebar · título do documento (editável) · status de sync ("✓ Sincronizado" / "Edited Xm ago") · botão "Compartilhar" · "?" (ajuda) · toggle de tema claro/escuro (lua/sol) · ícone de lista (☰) · ícone `<>` (provável visão markdown/código) · ícone de pessoas/avatar (roxo — provável colaboração) · botão primário "Salvar".

**Editor (painel esquerdo):**
- Headings grandes (H1/H2) + bullets aninhados com marcadores diferentes por nível (• depois ◦).
- Toolbar flutuante ao selecionar texto: dropdown de tipo de bloco ("Bullet List"), B, I, U, S (riscado), alinhamentos (esq/centro/dir), "A" (cor de texto?), destaque, outdent/indent, link.
- Checkboxes: item marcado fica riscado (strikethrough) com checkbox preenchido.
- Placeholder "List" em linha vazia de lista.
- Divider central arrastável entre editor e mindmap.

**Mindmap (painel direito, header "MINDMAP"):**
- Controles no header: « e » (expandir/recolher níveis?), ícone de grade (layout?), ícone de foco (selecionável, fica ativo), ícone de monitor (selecionável), ↗ (fullscreen/expandir painel).
- Zoom + / − e botão "fit" no canto inferior esquerdo do painel.
- Nó raiz destacado (cor cheia) com seta ">" para expandir; filhos como caixas claras; nó com filhos colapsados mostra badge circular com a CONTAGEM de descendentes.
- Nó selecionado no editor ganha borda destacada no mapa (sincronia editor↔mapa).
- No tema escuro os nós usam fonte mono e caixas com borda.

**Console do produto (screenshot com DevTools) — pistas de implementação:**
- `[ReactFlowMindmap] treeToFlowElements: Generated 9 nodes and 8 edges` → mindmap é React Flow sobre uma árvore.
- `getAllDescendantIds`, `Layout effect running. Collapsed: <ids>` → estado de colapso por nó.
- `Focus Mode: No changes needed for <uuid>` → existe um "focus mode" por nó.
- `MarkdownEditor: Content changed, emitting update` → editor markdown emite updates para o mapa.

## Answer

Inventário completo em [../research/01-inventario-produto-referencia.md](../research/01-inventario-produto-referencia.md).

- A transcrição completa foi obtida, mas o notepad só é citado UMA vez: "bloco de notas personalizado que eu criei" — é ferramenta pessoal do Renato Asse, fechada, sem doc pública e fora do repo opensquad. Não há descrição falada de features.
- O inventário foi montado por frames capturados do vídeo (7 timestamps) + os 5 screenshots + console.
- CONFIRMADO: sync editor→mindmap a cada tecla; focus mode (ícone alvo, mostra só o ramo em edição); colapso por nó com badge de contagem; nós recém-editados em rosa e nó do cursor com borda; blocos de código viram nós; checkbox marcado = riscado; autosave ("Edited Xm ago") + botão Salvar; 1 doc por UUID na URL (`/admin/notepad?note=<uuid>`); placeholder literal "Enter text or type '/' for commands" (menu slash existe).
- INFERIDO (nunca visto em ação): Compartilhar, sidebar, «/», grade, monitor, `<>`, drag do divider, atalhos markdown. Editor com assinatura de BlockNote/TipTap; mindmap é React Flow (console).
- Atalhos de teclado: nenhum demonstrado; só o "/" é confirmado.
