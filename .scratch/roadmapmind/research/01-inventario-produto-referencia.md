# Research 01 — Inventário funcional do notepad de referência

Vídeo: https://www.youtube.com/watch?v=62WpD75vnWE ("Opensquad - Guia completo de Instalação e criação de Squads de Agentes IA", canal Renato Asse - Sem Codar, ~28min, 31 mil views).
Data da pesquisa: 2026-07-30.

## Metodologia e fontes

1. **Transcrição completa** (legendas automáticas pt, via youtubetotranscript.com no browser — a API timedtext do YouTube está bloqueada por token).
2. **Frames do vídeo** capturados diretamente do player (seek + captura de frame em 1:35, 1:55, 3:52, 4:52, 15:40, 16:45, 17:42).
3. **Screenshots** já extraídos pela sessão de mapeamento (5 imagens, resumidas no ticket).
4. **Web/GitHub**: repositório `renatoasse/opensquad` NÃO contém o notepad; nenhuma página pública descreve o app.

### Fato central (CONFIRMADO pela transcrição)

O notepad é uma ferramenta **pessoal e fechada** do Renato Asse, não documentada em lugar nenhum. Citação literal do vídeo (~3:45): *"esse meu próprio bloco de notas que eu tenho aqui, é um bloco de notas personalizado que eu criei, né? Tem um monte de JavaScript aqui no meio"*. É a ÚNICA menção falada ao notepad nos 28 minutos — o vídeo é sobre instalar o OpenSquad; o notepad aparece só como ferramenta de apresentação do roteiro/checklist. Logo, **não existe transcript descrevendo funcionalidades**: o inventário abaixo vem de observação visual + console + inferência.

Roda em `materiais.semcodar.com.br/admin/notepad?note=<uuid>` (URL visível no frame 3:52) — rota admin, um documento por UUID.

## Inventário funcional

Legenda de confirmação: **F** = frame capturado do vídeo (timestamp) · **S** = screenshot da sessão de mapeamento · **C** = console/DevTools (screenshot) · **T** = transcrição · **I** = inferido (não visto em ação).

### Topbar

| Elemento | Comportamento | Confirmação | MVP? |
|---|---|---|---|
| Ícone home | Volta à lista/hub de documentos | S; comportamento **I** | sim |
| Toggle sidebar | Abre/fecha painel lateral (lista de notas) | S; conteúdo do painel **I** | sim |
| Título do documento | Editável inline ("Como Instalar Opensquad") | S, F 3:52 | sim |
| Status de sync | "✓ Sincronizado" / "Edited Xm ago" — atualiza sozinho enquanto edita (13m→1h ao longo do vídeo) | S, F 3:52/15:40 | sim |
| Botão "Compartilhar" | Compartilhamento do doc (modal não mostrado) | S, F; comportamento **I** | não |
| "?" | Ajuda | S, F; comportamento **I** | não |
| Lua/Sol | Toggle tema claro/escuro (vídeo roda todo no escuro; claro visto nos screenshots) | S, F | sim |
| Ícone lista (☰) | Provável outline/índice do doc | S; comportamento **I** | não |
| Ícone `<>` | Provável visão markdown cru/código | S; comportamento **I** | não |
| Ícone pessoas (roxo) | Provável colaboração/presença | S; comportamento **I** | não |
| Botão "Salvar" (roxo, primário) | Salva manualmente (coexiste com autosave do status) | S, F | sim |

### Editor (painel esquerdo)

| Elemento | Comportamento | Confirmação | MVP? |
|---|---|---|---|
| H1 + headings numerados | "Como instalar Opensquad" (H1), "1. Instalar uma IDE" (H2 numerado) | F 1:35 | sim |
| Bullets aninhados | Marcadores mudam por nível (• ◦ ▪); indentação ilimitada aparente (3+ níveis vistos) | S, F 4:52 | sim |
| Checkboxes | Item marcado ganha checkbox roxo preenchido + texto riscado; usado como checklist de progresso | S, F 4:52/15:40/17:42 | sim |
| Blocos de código | Caixa cinza arredondada para comandos (`npx opensquad update`, `/opensquad criar um novo squad`) | F 15:40/16:45 | sim |
| Placeholder de linha vazia | **"Enter text or type '/' for commands"** → existe menu de slash commands para inserir blocos | F 16:45 (texto literal visível) | sim |
| Placeholder "List" | Em linha vazia dentro de lista | S | sim |
| Toolbar flutuante ao selecionar | Dropdown tipo de bloco ("Bullet List") · B · I · U · S (riscado) · alinhamento esq/centro/dir · cor de texto ("A") · destaque · outdent/indent · link | S | parcial (B/I/S + tipo de bloco) |
| Digitação → mindmap ao vivo | Cada caractere digitado atualiza o nó correspondente no mapa em tempo real (nó nasce enquanto a palavra é digitada) | F 1:35, 1:55, 4:52, 17:42; C ("MarkdownEditor: Content changed, emitting update") | sim |
| Divider central | Arrastável, redimensiona editor × mindmap | S; arraste **I** | sim |

### Mindmap (painel direito, header "MINDMAP")

| Elemento | Comportamento | Confirmação | MVP? |
|---|---|---|---|
| Estrutura | Árvore esquerda→direita: raiz = doc, filhos = headings/bullets/code blocks. React Flow sobre árvore | F, C ("[ReactFlowMindmap] treeToFlowElements: 9 nodes / 8 edges") | sim |
| « e » (header) | Expandir/recolher níveis em massa | S; comportamento **I** | não |
| Ícone grade (header) | Provável re-layout/organizar | S; comportamento **I** | não |
| Ícone alvo/foco (header) | **Focus mode** — fica roxo quando ativo; o mapa passa a mostrar só o ramo em edição (visto: só os filhos da seção corrente aparecem) | F 15:40/16:45 (ativo) + C ("Focus Mode: No changes needed for <uuid>") | sim |
| Ícone monitor (header) | Selecionável; provável modo apresentação | S; comportamento **I** | não |
| ↗ (header) | Fullscreen/expandir o painel do mapa | S; comportamento **I** | não |
| Zoom + / − / fit | Canto inferior esquerdo do painel | S | sim |
| Retângulo branco (canto inf. esq.) | Provável minimap do React Flow | F 15:40/16:45; função **I** | não |
| Badge circular no nó | Nó com filhos colapsados mostra contagem de descendentes; clicar expande/colapsa | S + C ("getAllDescendantIds", "Collapsed: <ids>") | sim |
| Destaque de edição | Nós recém-editados ficam rosa/magenta; nó sob o cursor do editor ganha borda roxa (sincronia editor→mapa) | F 4:52 (rosa), F 1:55 (borda) | sim |
| Estilo dos nós | Tema escuro: fonte mono, raiz roxa preenchida, filhos teal preenchidos; texto quebra dentro da caixa | F 15:40/17:42, S | sim |
| Seta ">" no nó raiz | Expandir a raiz | S | sim |

### Persistência / navegação

| Elemento | Comportamento | Confirmação | MVP? |
|---|---|---|---|
| 1 doc = 1 UUID na URL (`?note=<uuid>`) | Deep-link por documento | F 3:52 | sim |
| Autosave + Salvar manual | Status "Edited Xm ago" avança sozinho; botão Salvar coexiste | F múltiplos | sim |
| Multi-documento | Home + sidebar sugerem lista de notas | **I** | sim |

## Atalhos de teclado

**Nenhum atalho do notepad foi demonstrado ou falado no vídeo.** Único confirmado: digitar `/` em linha vazia abre menu de comandos (placeholder literal, F 16:45). Atalhos markdown implícitos (ex.: `- ` para lista, `# ` para heading) são **INFERIDOS** do estilo do editor (padrão Notion/BlockNote/TipTap), não confirmados. O "Ctrl+P → Reload Window" dito no vídeo é do VS Code, não do notepad.

## O que a transcrição NÃO cobre (limitações)

- Nenhuma feature do notepad é explicada verbalmente; tudo acima é observação visual.
- Nunca vimos: modal de Compartilhar, sidebar aberta, menu "/", visão `<>`, ação dos botões «/»/grade/monitor, drag do divider, drag de nós no mapa.
- O app não é open source e não tem página pública (repo opensquad verificado — sem notepad).

## Pistas de implementação (para os protótipos 05/06)

- Mindmap: **React Flow** (console) com layout em árvore própria (`treeToFlowElements`), colapso por nó com `getAllDescendantIds`, focus mode por UUID de nó.
- Editor: floating toolbar com dropdown de bloco + slash commands + placeholders por bloco = assinatura de **BlockNote** (ou TipTap custom) — **INFERIDO**.
- Pipeline: editor emite update → parser markdown → árvore → nodes/edges → layout, a cada tecla (throttle provável).
