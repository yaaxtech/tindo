# 05 — Protótipo do editor outline

Type: prototype
Status: resolved
Blocked by: 01, 02

## Question

Como o editor deve se comportar e parecer? Construir protótipo descartável (skill /prototype) com a lib vencedora do ticket 02, cobrindo o inventário do ticket 01, para o dono reagir:

1. Bullets "criativos": marcador visual diferente a cada nível de indentação + linhas-guia na margem esquerda.
2. Modo numerado: 1. / 1.1. / 1.1.1. — alternável por documento (ou por seção?).
3. Tab / Shift-Tab movendo linhas na árvore; Enter criando irmão.
4. Checkbox: transformar linha em tarefa; pai com progresso (3/5) travado até filhas fecharem; forçar fechar pai → aviso → fecha filhas (decisão de fundação).
5. Toolbar flutuante de formatação (B/I/U/S, link, cor) como no produto de referência.
6. Colar markdown → vira árvore; copiar/exportar seleção → markdown.
7. Identidade visual TinDo (Obsidian + Jade), tema claro e escuro.
8. Convenções herdadas do padrão YaaX (`docs/03_UI_UX.md` §"Convenções herdadas", 2026-07-30): sem shadcn/Radix (componentes custom leves), lucide/currentColor, skeleton só no 1º load, empty states com CTA. Atenção especial: a UI padrão do BlockNote vem com tema próprio (Mantine) — validar no protótipo que dá pra vestir Obsidian+Jade por cima (theming/CSS vars) sem briga.

Sessão HITL: apresentar variantes onde houver dúvida real (ex.: estilos de marcador por nível) e colher reação do dono. Saída: protótipo linkado + lista do que mudou vs. inventário.

## Answer

**Vencedora: variante A "Zen" (minimalista)**, com ajuste pedido pelo dono: guias de indentação com **uma cor por nível** em tons neutros/dessaturados com transparência 0.65 (azul-acinzentado → areia → verde-sálvia → lilás → rosé) — distinguíveis, mas discretas. Aprovada em 2026-07-30 ("ficou bom").

Validado no protótipo (rota `/prototype/editor`, descartável):
- BlockNote veste Obsidian+Jade sem briga (CSS vars `--bn-colors-*` + overrides pontuais).
- Trava pai/filhas + "Concluir tudo" em cascata com aviso: funciona via `onChange` + revert + modal.
- Modo números 1.1.1 por CSS counters (com `!important` sobre o bullet interno) — funciona; **detalhe: checkboxes não entram na numeração** (só bullets contam) — decidir na spec se tarefas numeram.
- Copiar/colar markdown ok (`blocksToMarkdownLossy`/`tryParseMarkdownToBlocks`).
- Incidente resolvido: `@mantine/hooks` 9.5 exige React 19.2 (`useEffectEvent`) que o Next 15.0.3 não embute → **pin `@mantine/{core,hooks,utils}` 8.3.11 via overrides** + React do projeto atualizado RC-2024 → 19.2.8 estável + `reactStrictMode: false` (issue BlockNote #1347). Typecheck + 68 testes ✓.

Código do protótipo: `src/app/prototype/editor/` (nesta branch/worktree — vira primary source; não mergear em produção como está).
