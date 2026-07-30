# 02 — Escolha da lib do editor outline

Type: research
Status: resolved
Blocked by: —

## Question

Qual biblioteca de editor usar para o RoadMapMind? A escolha precisa sustentar TODOS os requisitos abaixo — a recomendação deve vir com evidência (docs oficiais, exemplos reais) e um veredito claro.

Requisitos (das decisões de fundação):
1. Modelo outline: o conteúdo é uma ÁRVORE de nós no banco (cada linha = nó; indentar/desindentar com Tab/Shift-Tab move nós na árvore). O editor precisa mapear de/para essa árvore sem gambiarra.
2. Markdown como língua de entrada/saída: colar markdown vira árvore; exportar subárvore vira markdown limpo.
3. Formatação inline por linha: negrito, itálico, sublinhado, riscado, link, cor (toolbar flutuante).
4. Checkboxes por linha (vira "tarefa"), com estado.
5. Bullets com marcador diferente por nível + modo numerado hierárquico (1., 1.1., 1.1.1.) + linhas-guia de indentação na margem.
6. Futuro (Fase 3): colaboração simultânea — a lib precisa ter caminho comprovado com CRDT (Yjs ou equivalente).
7. Stack: React 19 / Next.js 15 App Router, TypeScript strict, licença compatível com uso comercial sem custo proibitivo.

Candidatas a avaliar no mínimo: TipTap (ProseMirror), Lexical (Meta), ProseMirror puro, BlockNote, Plate. Considerar também editor outline custom (contenteditable por linha, tipo Workflowy) — avaliar honestamente custo/benefício vs lib pronta.

Entregável: comparativo curto + recomendação única com plano B.

## Answer

**Recomendação: BlockNote.** É a única candidata onde o requisito central já é o modelo nativo: cada bloco tem `{ id estável, children }` — árvore recursiva que mapeia 1:1 para a tabela de nós no banco — com Tab/Shift-Tab, checkbox, toolbar flutuante, markdown bidirecional e colaboração Yjs oficiais, tudo no core gratuito (MPL-2.0; os pacotes XL pagos — PDF/DOCX/AI — não são necessários). Lexical foi descartado porque seus NodeKeys são explicitamente não-estáveis/não-serializados; editor custom contenteditable-por-linha foi descartado (IME, undo, seleção multi-linha e mobile = meses reconstruindo o que ProseMirror resolve).

**Plano B: Tiptap v3** (MIT; UniqueID agora MIT; markdown oficial desde 3.7; Yjs self-host via Hocuspocus) montando o outline com nested lists — migração barata porque BlockNote roda sobre ProseMirror/Tiptap.

**Riscos aceitos:** BlockNote exige StrictMode desligado no Next 15/React 19 por ora (issue #1347) e a conversão markdown é declaradamente lossy (subset CommonMark+GFM, suficiente para outline).

Comparativo completo com fontes: `.scratch/roadmapmind/research/02-lib-editor-outline.md`
