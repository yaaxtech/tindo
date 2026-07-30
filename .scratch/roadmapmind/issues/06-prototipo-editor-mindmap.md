# 06 — Protótipo editor + mindmap lado a lado

Type: prototype
Status: resolved
Blocked by: 03, 05

## Question

Como fica a tela completa — editor à esquerda, mindmap à direita, sincronizados? Estender o protótipo do 05 com a tech do 03:

1. Mapa se refaz enquanto digita, com o "zoom por nível" (enquadra tudo do nível atual).
2. Colapsar/expandir nós com badge de contagem; focus mode.
3. Sincronia bidirecional (linha ↔ nó).
4. Divider arrastável; modos de tela: só documento / lado a lado / só mapa (decisão de fundação: os três modos existem).
5. Menu esquerdo de navegação (recolhível): árvore só dos nós que têm filhos ("documentos"); escolher um abre a visão a partir dali.
6. Controles do painel do mapa vindos do inventário (01): « », layout, foco, fullscreen, +/−/fit.
7. Convenções herdadas do padrão YaaX (`docs/03_UI_UX.md` §"Convenções herdadas", 2026-07-30) — mesmas notas do ticket 05 (sem shadcn/Radix, lucide, skeleton só no 1º load, empty states).

Sessão HITL com o dono reagindo ao protótipo. Saída: protótipo linkado + decisões de UX registradas.

## Answer

Protótipo aprovado pelo dono em 2026-07-30 ("ficou bom") após ~6 rodadas de iteração ao vivo. Código: `src/app/prototype/editor/` (primary source — não mergear como produção). Decisões de UX validadas, todas viram requisitos da spec (08):

**Tela**
- Overlay tela cheia (sem chrome do TinDo) · menu de documentos recolhível (☰) · editor · mindmap; modos Documento / Lado a lado / Mapa; divisor arrastável com grip ⋮⋮.
- Menu esquerdo: árvore só de linhas com filhos; setas › rotativas pra recolher/expandir; 1º item = NOME DO USUÁRIO (o documento raiz).
- **Título da página = documento em foco** (raiz → nome do usuário). Focar um documento isola editor E mapa (ancestrais somem; a linha focada vira o título). REGRA PRA SPEC: níveis internos sobem de hierarquia no foco (H3→H2 etc.) — no protótipo é visual.

**Mapa (React Flow, layout tidy custom)**
- Raiz virtual com nome do usuário; cores dos nós/arestas = paleta das guias por nível (painel 🎨 customiza; "automático" é default); orientação ⇄ horizontal / ⇅ vertical (mobile); colapso por alça pendurada com contagem; linha vazia já vira nó "…" (zoom não pula).
- Clique = seleciona + menu de ações com atalhos (Enter filha · Shift+Enter irmã · Delete exclui · voltar ao lugar · reorganizar SÓ as filhas); nó novo nasce em edição com zoom nele + na mãe.
- Duplo clique = edição inline (textarea; Shift+Enter quebra linha, refletida no nó); menus bloqueados durante edição; dica discreta no rodapé só durante edição.
- Arrastar: solto perto de outro nó = vira filho (alvo pulsa em jade tracejado; animação de posições); solto longe = posição manual.
- Checkbox no nó (trava pai/filhas vale); excluir com confirmação se houver descendentes.

**Editor**
- Dobrar/expandir linhas com filhas clicando no marcador (hover mostra ⌄; dobrado vira › jade).
- Menu slash em PT-BR (locale `pt` do BlockNote) com visual TinDo; respiro de 45vh no rodapé pro menu não cortar.

**Aprendizados técnicos p/ spec:** fitView do React Flow retorna Promise (engolir rejeição); pin @mantine 8.3.11 (React do Next 15.0.3); `reactStrictMode: false`; re-parent via clonagem de bloco (ids novos — na versão real, mover preservando id via RPC `mover_linha`).
