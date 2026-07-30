# Pesquisa 02 — Lib do editor outline (RoadMapMind)

Data: 2026-07-30 · Fontes: docs oficiais, repos e release notes (links em cada afirmação).

## Veredito

**Recomendação: BlockNote** (base ProseMirror/Tiptap, block-based).
**Plano B: Tiptap v3 puro** com extensão `UniqueID` (agora MIT) + lista aninhada custom.
**Rejeitados**: editor custom contenteditable-por-linha (custo proibitivo), Lexical (IDs de nó não-estáveis por design), Plate (camada extra sobre Slate sem ganho para outline), ProseMirror puro (só como fallback extremo — Tiptap já é ProseMirror com DX melhor).

---

## Requisito 1 — Árvore de nós com id estável por linha (o requisito decisivo)

| Lib | Como fica |
|---|---|
| **BlockNote** | **Nativo.** Cada bloco é `{ id, type, props, content, children }` — árvore recursiva, e "a block will keep the same ID from when it's created until it's removed" ([docs: document structure](https://www.blocknotejs.org/docs/foundations/document-structure)). Tab/Shift-Tab para nest/unnest de blocos já vem pronto. Mapeamento editor ↔ tabela de nós no banco é praticamente 1:1. |
| **Tiptap** | Viável com trabalho. O doc ProseMirror é uma árvore, mas ids estáveis exigem a extensão `UniqueID` — que era paga e foi **open-sourced sob MIT** junto com DragHandle, TableOfContents e outras ([release note oficial](https://tiptap.dev/blog/release-notes/were-open-sourcing-more-of-tiptap)). O modelo outline (linha = nó, filhos aninhados) precisa ser construído com nested list items ou nodes custom + comandos `sinkListItem`/`liftListItem`. |
| **Lexical** | **Contra-indicado para este requisito.** NodeKeys "are only present at runtime (not serialized), and should be considered to be random and opaque" ([docs: nodes](https://lexical.dev/docs/concepts/nodes); [discussion #2665](https://github.com/facebook/lexical/discussions/2665)). Id estável exigiria NodeState/atributo custom em todo nó — trabalho extra exatamente no ponto central do produto. |
| **Plate (Slate)** | MIT, tem plugin de node-id, mas é camada sobre Slate — histórico de instabilidade de API e problemas Android/IME do Slate; nenhum ganho específico para outline vs as opções ProseMirror. |
| **Custom** | Controle total, custo total (ver seção final). |

## Requisito 2 — Markdown (colar → árvore; subárvore → markdown)

- **BlockNote**: oficial no core — `tryParseMarkdownToBlocks()` e `blocksToMarkdownLossy()` ([docs: markdown](https://www.blocknotejs.org/docs/features/import/markdown)). Declaradamente **lossy**, cobre CommonMark + GFM básico (headings, listas, task lists, tabelas, código, links, ênfase). Bugs conhecidos: blockquote ([#1762](https://github.com/TypeCellOS/BlockNote/issues/1762)), tabelas ([#1377](https://github.com/TypeCellOS/BlockNote/issues/1377)). Para outline (bullets/checkboxes/inline), o subset coberto é suficiente; se precisar mais, docs recomendam parsear com remark/marked → HTML → `tryParseHTMLToBlocks`.
- **Tiptap**: extensão **Markdown oficial desde a v3.7.0**, bidirecional, CommonMark, open source — mas marcada como *early release* ([docs](https://tiptap.dev/docs/editor/markdown); [release note](https://tiptap.dev/blog/release-notes/introducing-bidirectional-markdown-support-in-tiptap)).
- **Lexical**: `@lexical/markdown` oficial e maduro.

## Requisitos 3–5 — Inline, checkboxes, bullets/numeração/guias

- Formatação inline (negrito/itálico/sublinhado/riscado/link/cor): todos cobrem. BlockNote traz **FormattingToolbar flutuante pronta** em React; Tiptap traz BubbleMenu (agora sobre Floating UI, [Tiptap 3.0 stable](https://tiptap.dev/blog/release-notes/tiptap-3-0-is-stable)); Lexical exige montar do zero.
- Checkbox por linha com estado: BlockNote `checkListItem` nativo; Tiptap TaskList/TaskItem (MIT); Lexical check list.
- Marcador por nível, numeração hierárquica (1.1.1) e linhas-guia: **nenhuma lib traz pronto** — é CSS + counters/props custom em qualquer escolha. No BlockNote o DOM já é aninhado por bloco com profundidade explícita, o que torna guias de indentação e counters CSS diretos.

## Requisito 6 — Colaboração Yjs (Fase 3)

- **BlockNote**: oficial via `withCollaboration` (Yjs), funciona com qualquer provider — Hocuspocus/y-websocket/y-webrtc (self-host, grátis) ou Liveblocks/PartyKit (hospedado) ([docs: collaboration](https://www.blocknotejs.org/docs/features/collaboration)).
- **Tiptap**: `@tiptap/extension-collaboration` + `y-prosemirror` são open source; backend **Hocuspocus é MIT e self-hostável** ([Hocuspocus docs](https://tiptap.dev/docs/hocuspocus/getting-started/overview)). O que é pago é o **Tiptap Cloud** (a partir de US$ 49/mês, free tier removido em jun/2025 — [pricing](https://tiptap.dev/pricing)); não é obrigatório.
- **Lexical**: `@lexical/yjs` + `CollaborationPlugin` oficiais ([docs](https://lexical.dev/docs/collaboration/react)).
- Todos têm caminho comprovado; empate técnico. BlockNote herda y-prosemirror por ser ProseMirror por baixo.

## Requisito 7 — Licença, custo, React 19 / Next 15 / TS strict

| Lib | Licença | Custo real | React 19 / Next 15 |
|---|---|---|---|
| BlockNote | Core **MPL-2.0** (ok em app comercial fechado); pacotes **XL** (exporters PDF/DOCX, multi-column, AI) são GPL-3 ou licença comercial ([pricing](https://www.blocknotejs.org/pricing)) | R$ 0 — markdown, collab e tudo que o RoadMapMind precisa estão no core, fora do XL | Funciona, **mas exige desabilitar StrictMode** no Next 15 / React 19 por ora ([docs Next.js](https://www.blocknotejs.org/docs/getting-started/nextjs); [#1347](https://github.com/TypeCellOS/BlockNote/issues/1347)). Client Component obrigatório (dynamic import, `ssr: false`). TS-first. |
| Tiptap | Editor **MIT** + 10 ex-Pro extensions MIT | R$ 0 self-host; Cloud US$ 49+/mês opcional | v3 estável com suporte a React 19 e SSR via `immediatelyRender: false` ([release](https://tiptap.dev/blog/release-notes/tiptap-3-0-is-stable)) |
| Lexical | **MIT** | R$ 0 | OK, TS |
| Plate | **MIT** | R$ 0 | OK |

## Editor outline custom (estilo Workflowy) — honestamente

**O que se ganha**: árvore 100% sob controle, zero impedância editor↔banco, bundle mínimo.
**O que se perde** (evidência de quem já pagou esse preço):
- contenteditable cru viola os invariantes básicos de um editor — foi a tese do artigo clássico da engenharia do Medium, que os obrigou a construir um model layer próprio ([Why ContentEditable is Terrible — Medium Engineering](https://medium.engineering/why-contenteditable-is-terrible-122d8a40e480); mesma conclusão no [blog do CKEditor](https://ckeditor.com/blog/ContentEditable-The-Good-the-Bad-and-the-Ugly/)).
- IME (chinês/japonês/coreano e autocorreção mobile) exige tratamento de composition events sem interferir no meio da composição — cada framework maduro tem centenas de commits só nisso.
- Contenteditable POR LINHA quebra de graça: seleção multi-linha nativa, undo/redo atravessando linhas, drag de texto entre linhas — tudo vira reimplementação manual.
- Colaboração Yjs sobre um modelo caseiro = escrever o próprio binding (o que y-prosemirror/\@lexical/yjs levaram anos para estabilizar).
**Veredito**: meses de trabalho para reconstruir o que ProseMirror já resolve, num app solo com IA como prioridade. **Não.**

---

## Recomendação final

**BlockNote**, porque o requisito 1 (cada linha = nó endereçável com id estável + children) é o coração do RoadMapMind e o BlockNote é a única candidata onde isso é o modelo nativo — junto com Tab/Shift-Tab, checkbox, toolbar flutuante, markdown e Yjs, tudo oficial e sem custo (nada do que precisamos está nos pacotes XL pagos).

**Plano B: Tiptap v3.** Se o problema de StrictMode/React 19 do BlockNote travar ou o projeto estagnar, migra-se para Tiptap puro (MIT, UniqueID grátis, markdown oficial, Hocuspocus self-host). A migração é a mais barata possível: BlockNote é construído sobre ProseMirror/Tiptap, então schema e conceitos se transferem.

**Riscos aceitos**:
1. StrictMode desabilitado no Next 15 enquanto o [#1347](https://github.com/TypeCellOS/BlockNote/issues/1347)/compat não fecha — mitigação: isolar o editor num Client Component com dynamic import.
2. Conversão markdown "lossy" com bugs de borda (blockquote/tabelas) — mitigação: nosso subset é bullets/checkbox/inline, o núcleo bem coberto; fallback remark→HTML.
3. BlockNote é projeto menor que Tiptap/Lexical — mitigação: plano B barato pela base ProseMirror comum.
