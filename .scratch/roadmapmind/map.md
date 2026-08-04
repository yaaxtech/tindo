# Mapa Wayfinder — RoadMapMind

Label: wayfinder:map
Referência do produto-inspiração: vídeo https://www.youtube.com/watch?v=62WpD75vnWE (notepad com editor à esquerda + mindmap React Flow à direita).

## Destination

Spec fechada do RoadMapMind (editor outline + mindmap + documentos aninhados + compartilhamento por linha + colaboração simultânea, em 3 fases) **e MVP da Fase 1 no ar** dentro do TinDo, rota `/docs`, desktop-first, single-user.

## Notes

- Domínio: TinDo (Next.js 15 + Bun + Supabase + Tailwind + Zustand + Framer Motion). Seguir `CLAUDE.md` e `docs/` do repo. Atenção: shadcn/Radix NÃO está instalado — componentes são custom leves (auditoria em `src/CLAUDE.md`, 2026-07-30).
- **Padrão YaaX importado em 2026-07-30** (commit `4d4086e`): protótipos e implementação seguem as convenções herdadas de UX (`docs/03_UI_UX.md` §"Convenções herdadas" — modais responsivos, datepicker custom, skeleton só no 1º load, empty states, lucide/currentColor) e os CLAUDE.md locais (`src/`, `src/services/`, `supabase/migrations/`). Implementação do MVP: fatiar em PRs incrementais mergeáveis; merge autônomo permitido com CI verde; suíte completa (`typecheck`+`lint`+`test`) antes de commitar.
- Dono não é dev e tem TDAH — comunicação nos padrões do CLAUDE.md global (resposta curta, opções clicáveis 🟢/🔴, uma pergunta por vez).
- Skills a consultar por sessão: `/grilling` + `/domain-modeling` para decisões; `/prototype` para UI; `/research` para fatos externos; `superpowers:writing-plans` para a spec final.
- SQL/migrations NUNCA vão para worker externo (política do dono) — schema fica com o cérebro (Claude).
- Identidade visual: base Obsidian + Jade YaaX (ver CLAUDE.md do projeto) — NÃO copiar o roxo do vídeo.
- O dono quer paridade funcional com o notepad do vídeo ("igual, com todas as funções e mais algumas") — o inventário do ticket 01 é o contrato dessa paridade.

## Decisions so far

<!-- fundação: decididas na sessão de mapeamento (grilling com o dono, 2026-07-30) -->

- **Destino em fases** — Fase 1 = MVP solo (editor+mindmap+docs aninhados+menu+checkboxes); Fase 2 = compartilhamento por linha + convites + atribuir tarefas; Fase 3 = edição simultânea. Cada fase usável sozinha.
- **Modelo A: árvore no banco, markdown como língua** — cada linha é um nó; "documento" = linha com filhos; markdown é entrada/saída (colar, exportar, alimentar IA); função no banco serializa qualquer subárvore em markdown pronto.
- **Tarefas hierárquicas** — pai travado até todas as filhas fecharem (mostra progresso); forçar fechamento do pai fecha as filhas COM aviso de confirmação.
- **Nome e rota** — produto se chama RoadMapMind na UI; rota `tindoapp.pages.dev/docs`; entra no menu do TinDo.
- **Desktop primeiro** — MVP pensado para tela grande; no celular abre modo simples (documento OU mapa, um por vez).
- **Uma filha pode ter várias mães (espelhos)** — a mesma linha pode aparecer sob mães diferentes e é uma só: editou num lugar, refletiu em todos (pedido do dono em 2026-07-30; detalhes no ticket 09, que emenda o schema do 04).
- **Convidado precisa de conta TinDo para editar** (Fase 2) — link público só-leitura é possibilidade a decidir na Fase 2.

- **Dependências aprovadas pelo dono (2026-07-30)** — BlockNote (editor) e React Flow (mindmap) autorizadas para instalação; exceção formal à regra "não alterar stack sem aprovação".

<!-- índice — uma linha por ticket fechado: -->

- [01 — Inventário do produto de referência](issues/01-inventario-produto-referencia.md) — inventário completo montado de frames do vídeo + screenshots + console (o notepad é ferramenta pessoal fechada do autor, sem doc pública). Confirmados: sync a cada tecla, focus mode, colapso com badge, destaque em nós editados, checkbox riscado, autosave+Salvar, menu slash. Botões "Compartilhar"/sidebar/ícones do header: comportamento inferido, não demonstrado.
- [02 — Lib do editor outline](issues/02-lib-editor-outline.md) — BlockNote (core gratuito, MPL-2.0): único com árvore nativa de blocos com id estável + children, que mapeia 1:1 na tabela de nós; Tab/Shift-Tab, checkbox, markdown e Yjs oficiais. Plano B: Tiptap v3. Riscos: StrictMode off por ora (issue #1347); markdown lossy (subset suficiente).
- [03 — Tech do mindmap](issues/03-tech-mindmap.md) — React Flow (MIT) + d3-hierarchy + animação de posições; `fitView` por subconjunto resolve zoom-por-nível/focus; colapso via `hidden` com badge; risco de milhares de nós mitigado com subárvores colapsadas desde o dia 1. Plano B: markmap.
- [04 — Schema do banco](issues/04-schema-banco.md) — tabela única `doc_linhas` (linha = registro, id = id do bloco BlockNote); `conteudo` jsonb (editor) + `texto_md` derivado no write (IA/busca direto no banco); ordenação por fractional indexing; RPCs `documento_como_markdown`, `concluir_tarefa` (trava pai / força com cascata atômica) e `mover_linha`; permissões Fase 2 via RPC com guard (RLS recursiva descartada); sem campo especulativo de sync.
- [07 — Tech de colaboração simultânea](issues/07-tech-colaboracao-simultanea.md) — Yjs (BlockNote `withCollaboration`) + y-partyserver em Cloudflare Durable Objects (US$0–5/mês); fallback Hocuspocus em Railway/Fly; Postgres = verdade de leitura, snapshot Yjs (`doc_yjs_state`) = verdade de merge; MVP já cumpre o contrato — só precisa de escrita centralizada em `services/doc.ts` + upserts idempotentes.
- [05 — Protótipo do editor](issues/05-prototipo-editor.md) — variante A "Zen" aprovada pelo dono, com guias de indentação em cor-por-nível neutra e translúcida; trava pai/filhas, cascata com aviso, modo 1.1.1 e markdown validados no protótipo `/prototype/editor`; pin Mantine 8.3.11 + React 19.2 estável resolveram o crash de `useEffectEvent`.
- [06 — Protótipo editor + mindmap](issues/06-prototipo-editor-mindmap.md) — aprovado após ~6 rodadas ao vivo: tela cheia com menu de docs recolhível + 3 modos, título = doc em foco (raiz = nome do usuário), foco isola editor e mapa, mapa React Flow com raiz virtual, cores por nível customizáveis, orientação ⇄/⇅, menu de ações com atalhos (Enter/Shift+Enter/Delete), edição inline, arrastar re-pluga (com highlight) ou posiciona manual, checkbox no nó, dobra de linhas no editor. Detalhes completos no ticket.
- [09 — Múltiplas mães (espelhos)](issues/09-multiplas-maes.md) — modelo espelho aprovado: linha tem casa principal + tabela `doc_espelhos` referenciando (conteúdo nunca duplica); apagar espelho ≠ apagar linha; apagar original avisa e oferece promover espelho; permissão herda só pelo caminho real; espelho aparece com ícone ↻ e aresta pontilhada no mapa. Emenda o schema do 04.
- [08 — Spec da Fase 1 (MVP)](issues/08-spec-fase-1.md) — **spec fechada** em `docs/superpowers/plans/2026-07-30-roadmapmind-fase-1-mvp.md` (formato writing-plans, executável). Corte fechado com o dono: espelhos entram na Fase 1 (última fatia, adiável); auth segue a ponte do app (schema RLS-ready); tarefas não numeram; foco sobe hierarquia. 9 fatias mergeáveis; SQL (doc_linhas+doc_espelhos+3 RPCs) fica com o cérebro. **Cruza a linha de chegada do planejamento** — a seguir: MVP no ar.

## Not yet specified

- **Compartilhamento Fase 2 (detalhes)**: fluxo de convite, papéis leitura/edição, link público só-leitura, como docs compartilhados entram e se ordenam no menu do convidado (estilo Drive), atribuição de tarefa a pessoas. Aguarda schema (04) e MVP.
- **TinDo multi-user**: hoje o TinDo é single-user; convidados criam conta — o que um convidado vê do resto do app? Aguarda Fase 2.
- **Colaboração simultânea (Fase 3)**: presença, cursores, resolução de conflito — depende da pesquisa de tech (07).
- **"Grande mapa infinito"**: navegar o documento-raiz inteiro como um mindmap contínuo com zoom in/out entre documentos — afinar depois dos protótipos (05, 06).
- **Mobile caprichado** (pós-MVP).
- **Specs das Fases 2 e 3** (a Fase 1 tem ticket próprio: 08).

## Out of scope

- **Sync de tarefas com TinDo (fila de cards) e Todoist** — explicitamente futuro, fora deste mapa (decisão do dono em 2026-07-30). O schema (ticket 04) nasce preparado para essa ponte, mas a ponte em si é outro esforço.
