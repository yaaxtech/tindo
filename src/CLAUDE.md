# Frontend (React + TS + Tailwind) — convenções locais

> Este arquivo carrega quando o cwd inclui `src/`. Complementa o CLAUDE.md raiz.
> Portado do padrão YaaX (2026-07-30) e adaptado ao TinDo: single-user (sem
> RBAC/multi-tenant), stack sem shadcn/Radix instalado — componentes são
> custom leves.

## REGRAS

- **Strict TS, sem `any` injustificado.** Se precisar, comente o motivo.
- **Toda leitura/escrita de dados via `src/services/`** — jamais Supabase direto em componentes.
- **Mensagens de erro para usuário em PT-BR.**
- **Antes de commitar:** `bun run typecheck && bun run lint`.

## JÁ SEGUIDO (confirmado nesta auditoria — manter)

- **Navegação = `next/link` `<Link href>` real** (não `<button>+router.push`):
  já é o padrão em `Sidebar.tsx`/`BottomNav.tsx`. `<Link>` do Next já
  renderiza `<a href>` de verdade — middle-click/Cmd/Ctrl+clique abrem nova
  aba nativamente, de graça. Manter em qualquer nav novo.
- **Ícones via lucide-react** (`currentColor`) — nunca `<img>` de SVG/webp
  colorido, que fica invisível ao trocar de fundo (claro↔escuro).

## PADRÕES OBRIGATÓRIOS (novos ou parcialmente aplicados)

- **Dialogs/modais** com atalhos: **Enter** aciona a ação primária
  (respeitando `disabled`); **Esc** cancela/fecha.
- **Validação de campos obrigatórios**: `useFormValidation` (já em uso em
  `login/page.tsx` e `TarefaModal.tsx`) + asterisco vermelho no label +
  borda/ring vermelho + scroll/flash até o 1º campo inválido ao salvar.
- **Validação 0-safe:** nunca `!!` em campo numérico (0 é falsy e válido).
  Valide `!== ''` / `!= null`.
- **Carregamento defensivo:** durante load, retorne vazio/disabled — NUNCA
  fallback permissivo. `undefined` = ainda carregando; `[]` = carregado e
  vazio de verdade. Não confundir os dois estados.
- **Skeleton só no 1º load:** refetch/atualização silenciosa (ex.: sync
  Todoist, recalcular notas) não deve piscar skeleton — mantém o conteúdo
  anterior até o novo chegar. Gate correto: `if (loading && dados.length === 0)`.
- **Input DECIMAL sempre em pt-BR (vírgula)** quando for campo de TEXTO
  editável: nunca `<input type="number">` pra decimal (força ponto, ignora
  locale). Isso NÃO se aplica ao `<input type="range">` do multiplicador de
  projeto (`/projetos`), que já é seguro por natureza (slider, não texto
  digitado) — a regra vale se algum dia esse valor virar campo de texto.
- **Datas: preferir calendário customizado a `<input type="date">` nativo.**
  Gap atual conhecido: `EditarDataPopover.tsx` e `TarefaModal.tsx` ainda usam
  `<input type="date">` nativo (picker feio e inconsistente entre
  navegadores). Convenção vale **daqui pra frente** — não é retrofit
  automático destes dois arquivos; ao tocar neles por outro motivo,
  considerar migrar.

## MODAIS RESPONSIVOS

- Escala semântica de tamanho (`sm`→`5xl`) e `mobileFullScreen` (tela cheia
  <640px com footer fixo, corpo rola) — regra: modal de *formulário* vira
  tela cheia no mobile; confirmação curta (1 ação, ≤1 campo) fica
  centralizada mesmo no mobile.
- **Forms com 5+ campos** em modais largos (`2xl`+): grid de 2 colunas no
  desktop preservando ordem de leitura esquerda→direita→baixo (row-major),
  idêntica ao mobile (1 coluna) — nunca column-major (encher a esquerda e
  jogar o resto na direita).

## COMBOBOXES E MULTISELECT (para quando as listas de projeto/tag crescerem)

- Hoje `TarefaModal.tsx` usa `<select>` nativo pra projeto/tags — ok
  enquanto a lista é pequena. Se crescer a ponto de precisar de busca:
  combobox foca o campo de busca ao abrir; multiselect traz os itens já
  marcados pro TOPO (snapshot na abertura — nada "pula", reordena só ao
  reabrir).

## CHECAGENS PRÉ-COMMIT

```bash
bun run typecheck
bun run lint
bun run test
```
