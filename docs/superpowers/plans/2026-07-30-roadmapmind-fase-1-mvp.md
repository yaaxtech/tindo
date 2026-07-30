# RoadMapMind — Fase 1 (MVP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Regra do dono (herdada do CLAUDE.md):** SQL/migrations/RPCs **NÃO** vão para worker externo — as fatias de banco (0, e as partes SQL de 3/5/7) são do cérebro (Claude). Frontend/UI pode ir para worker (K3/Sol). Todo diff é revisado por outro par de olhos (quem escreve não aprova).

**Goal:** Colocar no ar, dentro do TinDo (rota `/docs`), um editor outline + mindmap sincronizados, com documentos aninhados, tarefas hierárquicas e espelhos — MVP solo (single-user), desktop-first.

**Architecture:** Uma árvore de nós no Postgres (`doc_linhas`, um registro por linha do outline). O editor é BlockNote (cada bloco = uma linha, id estável); o mapa é React Flow renderizando a mesma árvore. Markdown é língua de entrada/saída (colar/exportar), derivado no write. Toda escrita passa por uma camada de serviço única (`src/services/doc.ts`) com upserts idempotentes — contrato que deixa a colaboração Yjs da Fase 3 encaixar sem reescrita.

**Tech Stack:** Next.js 15 (App Router) · Bun · TypeScript strict · Supabase (Postgres 15 + RLS) · Tailwind · **BlockNote `@blocknote/{core,react,mantine}@^0.52.1`** (editor) · **React Flow `@xyflow/react@^12.11.2`** (mapa) · **`fractional-indexing`** (ordenação de irmãos) · Zustand (estado da tela) · lucide-react (ícones).

## Global Constraints

Todo requisito de toda task inclui implicitamente esta seção. Valores copiados verbatim das decisões dos tickets 01–09.

- **Dependências fixadas** (validadas nos protótipos 05/06): `@blocknote/core@^0.52.1`, `@blocknote/react@^0.52.1`, `@blocknote/mantine@^0.52.1`, `@xyflow/react@^12.11.2`, `fractional-indexing` (última). Aprovadas pelo dono em 2026-07-30 — exceção formal à regra "não alterar stack".
- **Pin obrigatório** via `overrides` no `package.json`: `@mantine/core`, `@mantine/hooks`, `@mantine/utils` **exatos em `8.3.11`** (Mantine 9.5 exige `useEffectEvent` que o Next 15.0.3 não embute → crash). BlockNote puxa Mantine transitivamente; sem o pin, quebra.
- **React estável 19.2**: subir `react`/`react-dom` do RC atual (`19.0.0-rc-…`) para `^19.2.0` e `@types/react`/`@types/react-dom` para `^19` (o protótipo já validou). Registrar no `overrides`.
- **`next.config.mjs`**: `reactStrictMode: false` (BlockNote issue TypeCellOS/BlockNote#1347) + `experimental.reactCompiler: false`. Comentar o motivo no código (em inglês).
- **Sem shadcn/Radix** — componentes custom leves (auditoria `src/CLAUDE.md`, 2026-07-30). BlockNote traz tema Mantine próprio: vesti-lo de Obsidian+Jade via CSS vars `--bn-colors-*` + overrides pontuais (validado no ticket 05).
- **Identidade visual**: base Obsidian (`#0A0E13`/`#121820`/`#1B222C`) + Jade YaaX (`#198B74`/`#2CAF93`); jade reservado a sucesso/OK; **nunca** o roxo do vídeo de referência. Tema claro e escuro.
- **Ícones**: lucide-react com `currentColor` — nunca `<img>` de SVG colorido.
- **Acesso a dados**: toda leitura/escrita via `src/services/doc.ts` — componente nunca toca o cliente Supabase. Erros de usuário em **PT-BR**.
- **Auth (MVP)**: seguir o padrão vigente do app — API routes usam `getAdminClient()` (service role) + `getUsuarioIdMVP()` de `src/lib/supabase/admin.ts`, com **guard manual de `usuario_id` em toda query e RPC**. O schema já nasce com RLS `usuario_id = auth.uid()` para quando o login real chegar (herda de graça). Não criar login novo nesta fase.
- **Convenções de banco** (checklist `supabase/migrations/CLAUDE.md`): `id uuid` PK, `usuario_id uuid NOT NULL REFERENCES auth.users(id)`, soft delete (`deleted_at`), `updated_at` via trigger `set_updated_at()`, status via `varchar + CHECK` (nunca enum PG), índice em toda FK.
- **Copy/UI 100% PT-BR**; defaults de config comentados em inglês.
- **Antes de commitar/mergear cada fatia**: `bun run typecheck && bun run lint && bun run test` (suíte completa). PR incremental mergeável; merge autônomo permitido com CI verde.
- **Fase 3 (contrato mínimo, respeitar já)**: id do bloco = id da linha (uuid estável); conteúdo jsonb por linha; `pai_id` + `ordem` fracional; `updated_at` + soft delete; **toda escrita centralizada em `services/doc.ts`**; upserts idempotentes. Nome `doc_yjs_state` fica **reservado** (não criar a tabela agora — YAGNI; a Fase 3 cria).

## Corte do MVP (fechado com o dono em 2026-07-30)

| Área | ✅ Entra na Fase 1 | ⏳ Fica para depois |
|---|---|---|
| Editor | bullets por nível + guias de indentação coloridas · Tab/Shift-Tab/Enter · dobrar/expandir linha · modo numerado 1.1.1 · formatação (B/I/U/S, link, cor de texto, destaque) · menu "/" pt-BR · colar markdown→árvore · blocos de código | alinhamento de texto · visão markdown cru (`<>`) · botão exportar markdown (RPC existe; UI depois) |
| Tarefas | checkbox→tarefa · trava pai até filhas fecharem (com progresso) · "concluir tudo" em cascata com aviso | atribuir tarefa a pessoas (Fase 2) |
| Mapa | React Flow ao vivo (sync a cada tecla) · colapso com badge de contagem · focus mode · zoom por nível · 3 modos (texto/lado a lado/mapa) + divider · sincronia bidirecional · editar inline no nó · menu de ações (Enter/Shift+Enter/Delete) · arrastar re-pluga (valida ciclo) · cores por nível · orientação ⇄/⇅ | «/» massa · grade · modo apresentação (monitor) · minimap · "grande mapa infinito" entre documentos |
| Navegação | menu lateral recolhível (só linhas com filhas = "documentos") · foco isola editor+mapa · título = doc em foco (raiz = nome do usuário) · deep-link `/docs?doc=<uuid>` · item no menu do TinDo | — |
| Persistência | autosave + botão Salvar · status de sync · schema multi-user-ready | login real · link público só-leitura (Fase 2) |
| Espelhos | tabela + proteção contra loop **e** UI de espelhar (Alt-drag / "/espelhar em…", ícone ↻, aresta pontilhada) — **última fatia, adiável** | refinamento de permissão de espelho (Fase 2) |
| Colaboração | só o contrato (escrita única, ids estáveis, upsert idempotente) | Yjs / presença / cursores (Fase 3) |
| Mobile | não quebra + modo simples (um painel por vez) | mobile caprichado |
| Fora do mapa | — | sync com fila de cards do TinDo / Todoist |

## File Structure

```
supabase/migrations/
  20260730000001_roadmapmind_doc_linhas.sql   # doc_linhas + RPCs + trigger + RLS
  20260730000002_roadmapmind_espelhos.sql     # doc_espelhos + RLS (aplicada na Fatia 7)

src/types/
  doc.ts                        # tipos de domínio (camelCase) da árvore de nós
  database.ts                   # regenerado por `bun run db:types` (não editar à mão)

src/services/
  doc.ts                        # ÚNICA ponte de dados do RoadMapMind (CRUD + RPCs)
  doc.test.ts                   # testes do mapeamento blocos↔linhas e do service
  doc-markdown.ts               # blocosParaLinhas / linhasParaBlocos / derivar texto_md
  doc-markdown.test.ts

src/app/docs/
  page.tsx                      # rota /docs (Server Component: garante raiz, carrega doc)
  RoadMapMind.tsx               # shell client: 3 modos, divider, orquestra editor+mapa
  Editor.tsx                    # BlockNote (tema Obsidian+Jade, slash pt-BR, tarefas)
  Mindmap.tsx                   # React Flow (layout, colapso, focus, edição no nó, drag)
  MenuDocumentos.tsx            # árvore lateral recolhível (linhas com filhas)
  useDocStore.ts                # Zustand: doc em foco, modo de tela, colapso, seleção
  roadmapmind.css               # CSS vars Obsidian+Jade sobre BlockNote + guias por nível

src/app/api/docs/
  route.ts                      # GET carregar / PUT salvar (upsert idempotente)
  [id]/route.ts                 # ações por linha: concluir, mover, espelhar, exportar
```

`src/app/prototype/editor/` (no worktree `roadmapmind-doc-mindmap`) é **primary source** de UX/comportamento — o executor porta de lá `Editor.tsx`/`Mindmap.tsx`/CSS, adaptando de "clonagem de bloco" para persistência real via `doc.ts`. **Não** mergear o protótipo como produção.

## Data Model (SQL completo — cérebro/Claude)

Fonte: ticket 04 (schema) + ticket 09 (espelhos). Aplicar via `supabase/migrations` seguindo o checklist pré-apply.

```sql
-- 20260730000001_roadmapmind_doc_linhas.sql
create table public.doc_linhas (
  id uuid primary key default gen_random_uuid(),        -- = id do bloco BlockNote (uuid gerado no cliente)
  usuario_id uuid not null references auth.users(id),   -- dono do documento-raiz
  pai_id uuid null references public.doc_linhas(id),    -- NULL só na raiz do usuário
  ordem text not null,                                  -- fractional index (ordenável lexicograficamente)
  conteudo jsonb not null default '[]'::jsonb,          -- inline content BlockNote (fonte do editor)
  texto_md text not null default '',                    -- derivado no write: markdown p/ IA/busca/export
  tipo varchar(20) not null default 'texto'
    check (tipo in ('texto','tarefa','codigo')),
  tarefa_estado varchar(20) null
    check (tarefa_estado in ('aberta','concluida')),
  modo_lista varchar(20) not null default 'herdado'
    check (modo_lista in ('herdado','marcadores','numeros')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  check ((tipo = 'tarefa') = (tarefa_estado is not null))
);

-- 1 raiz por usuário:
create unique index doc_linhas_uma_raiz on public.doc_linhas (usuario_id)
  where pai_id is null and deleted_at is null;
-- navegação e FKs:
create index doc_linhas_pai_ordem on public.doc_linhas (pai_id, ordem) where deleted_at is null;
create index doc_linhas_usuario on public.doc_linhas (usuario_id);

create trigger set_updated_at before update on public.doc_linhas
  for each row execute function public.set_updated_at();   -- helper já existe (migration 000001)

alter table public.doc_linhas enable row level security;
create policy doc_linhas_owner on public.doc_linhas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- RPC: serializa qualquer subárvore em markdown (IA/export). DFS pré-ordem via caminho de ordens.
create or replace function public.documento_como_markdown(p_linha uuid)
returns text language sql security invoker stable as $$
  with recursive arvore as (
    select f.id, f.texto_md, f.tipo, f.tarefa_estado, 1 as nivel, array[f.ordem] as caminho
    from public.doc_linhas f
    where f.pai_id = p_linha and f.deleted_at is null
    union all
    select f.id, f.texto_md, f.tipo, f.tarefa_estado, a.nivel + 1, a.caminho || f.ordem
    from public.doc_linhas f
    join arvore a on f.pai_id = a.id
    where f.deleted_at is null
  )
  select coalesce(string_agg(
    repeat('  ', nivel - 1) ||
    case
      when tipo = 'tarefa' then '- [' || case when tarefa_estado = 'concluida' then 'x' else ' ' end || '] '
      else '- '
    end || texto_md,
    E'\n' order by caminho
  ), '')
  from arvore;
$$;

-- RPC: concluir tarefa. Sem forçar: erro se houver descendente-tarefa aberto. Com forçar: cascata atômica.
create or replace function public.concluir_tarefa(p_linha uuid, p_forcar boolean default false)
returns void language plpgsql security invoker as $$
declare v_abertas int;
begin
  with recursive sub as (
    select id from public.doc_linhas where id = p_linha and deleted_at is null
    union all
    select f.id from public.doc_linhas f join sub s on f.pai_id = s.id where f.deleted_at is null
  )
  select count(*) into v_abertas from public.doc_linhas
  where id in (select id from sub) and id <> p_linha
    and tipo = 'tarefa' and tarefa_estado = 'aberta' and deleted_at is null;

  if v_abertas > 0 and not p_forcar then
    raise exception 'TAREFA_TEM_FILHAS_ABERTAS' using errcode = 'P0001';
  end if;

  if p_forcar then
    with recursive sub as (
      select id from public.doc_linhas where id = p_linha and deleted_at is null
      union all
      select f.id from public.doc_linhas f join sub s on f.pai_id = s.id where f.deleted_at is null
    )
    update public.doc_linhas set tarefa_estado = 'concluida', updated_at = now()
    where id in (select id from sub) and tipo = 'tarefa' and deleted_at is null;
  else
    update public.doc_linhas set tarefa_estado = 'concluida', updated_at = now() where id = p_linha;
  end if;
end;
$$;

-- RPC: mover linha validando ciclo (destino não pode ser a própria linha nem descendente dela).
create or replace function public.mover_linha(p_linha uuid, p_novo_pai uuid, p_ordem text)
returns void language plpgsql security invoker as $$
begin
  if p_novo_pai = p_linha then raise exception 'CICLO' using errcode = 'P0001'; end if;
  if exists (
    with recursive sub as (
      select id from public.doc_linhas where id = p_linha and deleted_at is null
      union all
      select f.id from public.doc_linhas f join sub s on f.pai_id = s.id where f.deleted_at is null
    )
    select 1 from sub where id = p_novo_pai
  ) then raise exception 'CICLO' using errcode = 'P0001'; end if;

  update public.doc_linhas set pai_id = p_novo_pai, ordem = p_ordem, updated_at = now()
  where id = p_linha and deleted_at is null;
end;
$$;
```

```sql
-- 20260730000002_roadmapmind_espelhos.sql  (aplicada na Fatia 7)
create table public.doc_espelhos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  linha_id uuid not null references public.doc_linhas(id),   -- a linha original (conteúdo nunca duplica)
  mae_id uuid not null references public.doc_linhas(id),     -- onde o espelho aparece
  ordem text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  unique (linha_id, mae_id)
);
create index doc_espelhos_mae on public.doc_espelhos (mae_id, ordem) where deleted_at is null;
create index doc_espelhos_linha on public.doc_espelhos (linha_id);
alter table public.doc_espelhos enable row level security;
create policy doc_espelhos_owner on public.doc_espelhos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
-- Na Fatia 7: estender mover_linha e documento_como_markdown para considerar espelhos
-- (validação de ciclo via espelhos; markdown marca o espelho e corta recursão por visitados).
```

**Notas de auth nas RPCs:** SECURITY INVOKER. No MVP o service usa service role (bypassa RLS), então `doc.ts` **valida posse** (`usuario_id = getUsuarioIdMVP()`) da `p_linha` antes de chamar qualquer RPC. Quando o login real chegar, a RLS reforça sozinha. Nunca chamar RPC sem o guard de posse no service.

## Contratos de serviço (`src/services/doc.ts`)

Tipos de domínio (camelCase) — Task 0 os produz; todas as tasks seguintes os consomem.

```ts
export type TipoLinha = 'texto' | 'tarefa' | 'codigo';
export type TarefaEstado = 'aberta' | 'concluida';
export type ModoLista = 'herdado' | 'marcadores' | 'numeros';

export interface DocLinha {
  id: string;              // uuid = id do bloco BlockNote
  paiId: string | null;
  ordem: string;           // fractional index
  conteudo: unknown[];     // inline content BlockNote (jsonb)
  textoMd: string;
  tipo: TipoLinha;
  tarefaEstado: TarefaEstado | null;
  modoLista: ModoLista;
}

// Cria a raiz (pai_id NULL, texto = nome do usuário) se não existir; retorna-a.
export async function garantirRaiz(): Promise<DocLinha>;
// Carrega a subárvore inteira a partir de uma raiz (default: a raiz do usuário).
export async function carregarDocumento(raizId?: string): Promise<DocLinha[]>;
// Upsert idempotente de linhas alteradas (por id). Deriva texto_md no service antes de gravar.
export async function salvarLinhas(linhas: DocLinha[]): Promise<void>;
// Soft delete (deleted_at = now) das linhas e de sua subárvore.
export async function removerLinhas(ids: string[]): Promise<void>;
// RPC concluir_tarefa (com guard de posse antes de chamar).
export async function concluirTarefa(linhaId: string, forcar?: boolean): Promise<void>;
// RPC mover_linha (com guard de posse).
export async function moverLinha(linhaId: string, novoPaiId: string, ordem: string): Promise<void>;
// RPC documento_como_markdown.
export async function exportarMarkdown(linhaId: string): Promise<string>;
```

Mapeamento (`src/services/doc-markdown.ts`):

```ts
// Achata o documento BlockNote (blocos aninhados) em linhas planas com pai_id + ordem fracional.
export function blocosParaLinhas(blocos: unknown[], paiId: string | null): DocLinha[];
// Reconstrói o array aninhado de blocos BlockNote a partir das linhas planas.
export function linhasParaBlocos(linhas: DocLinha[]): unknown[];
// Deriva o markdown de UMA linha (inline content → texto md), sem descer na árvore.
export function derivarTextoMd(conteudo: unknown[], tipo: TipoLinha, tarefaEstado: TarefaEstado | null): string;
```

---

### Task 0: Fundação — deps, config, schema, service esqueleto, rota vazia

**Files:**
- Modify: `package.json` (deps + overrides), `next.config.mjs`
- Create: `supabase/migrations/20260730000001_roadmapmind_doc_linhas.sql`
- Create: `src/types/doc.ts`, `src/services/doc.ts` (esqueleto), `src/app/docs/page.tsx` (placeholder protegido)
- Modify: `src/types/database.ts` (regenerar via `bun run db:types`)

**Interfaces:**
- Produces: os tipos e assinaturas de `src/services/doc.ts` acima; a migration `doc_linhas` + 3 RPCs; rota `/docs` respondendo 200.

- [ ] **Step 1:** Adicionar deps e overrides no `package.json` (valores exatos da seção Global Constraints), subir react/react-dom → `^19.2.0`, tipos → `^19`. Rodar `bun install`.
- [ ] **Step 2:** Editar `next.config.mjs`: `reactStrictMode: false` + `experimental.reactCompiler: false` com comentário do motivo (inglês).
- [ ] **Step 3:** Escrever a migration `20260730000001_roadmapmind_doc_linhas.sql` (SQL da seção Data Model — só `doc_linhas` + trigger + RLS + 3 RPCs; espelhos NÃO). Aplicar via Supabase MCP `apply_migration` (cérebro).
- [ ] **Step 4:** `bun run db:types` para regenerar `src/types/database.ts`; criar `src/types/doc.ts` com os tipos de domínio.
- [ ] **Step 5:** Criar `src/services/doc.ts` esqueleto: `garantirRaiz`/`carregarDocumento`/`salvarLinhas` implementados (via `getAdminClient()`+`getUsuarioIdMVP()`, guard de `usuario_id`, filtro `deleted_at is null`); RPCs como wrappers. `removerLinhas` implementado (soft delete).
- [ ] **Step 6:** Criar `src/app/docs/page.tsx` (Server Component) que chama `garantirRaiz()` e renderiza um placeholder "RoadMapMind em construção".
- [ ] **Step 7:** `bun run typecheck && bun run lint && bun run test`; commit.

**Critérios de aceite:**
- Migration aplica sem erro; `list_tables` mostra `doc_linhas`; as 3 RPCs existem.
- `garantirRaiz()` cria exatamente 1 raiz por usuário (o índice único garante); chamar 2× não duplica.
- `GET /docs` responde 200 e a raiz existe no banco.
- `documento_como_markdown(raiz)` de um doc semeado à mão devolve markdown indentado correto (verificar via `execute_sql`).

**Como testar:** aplicar migration → `execute_sql` semeando 3 linhas (raiz + 2 filhas, uma tarefa) → `select documento_como_markdown(<raiz>)` confere indentação e `- [ ]`.

---

### Task 1: Editor + persistência (o loop mínimo que grava e recarrega)

**Files:**
- Create: `src/app/docs/Editor.tsx`, `src/app/docs/roadmapmind.css`, `src/app/docs/RoadMapMind.tsx` (shell mínimo), `src/app/docs/useDocStore.ts`
- Create: `src/services/doc-markdown.ts`, `src/services/doc-markdown.test.ts`, `src/services/doc.test.ts`
- Create: `src/app/api/docs/route.ts` (GET carregar / PUT salvar)
- Modify: `src/app/docs/page.tsx` (renderiza `RoadMapMind`)

**Interfaces:**
- Consumes: tipos e service da Task 0.
- Produces: `blocosParaLinhas`/`linhasParaBlocos`/`derivarTextoMd`; endpoint `PUT /api/docs` (upsert idempotente); autosave debounced.

- [ ] **Step 1 (test first):** Em `doc-markdown.test.ts`, escrever teste do round-trip: `linhasParaBlocos(blocosParaLinhas(blocosExemplo, null))` preserva ids, aninhamento e ordem. Rodar → falha (função não existe).
- [ ] **Step 2:** Implementar `blocosParaLinhas`/`linhasParaBlocos`/`derivarTextoMd` (ordem fracional via `fractional-indexing`, ids preservados). Rodar teste → passa.
- [ ] **Step 3 (test first):** Em `doc.test.ts`, com o cliente Supabase mockado (padrão `services/__mocks__` / `kpis-adiamento.test.ts`), testar que `salvarLinhas` faz **upsert por id** (idempotente: salvar as mesmas linhas 2× resulta no mesmo estado) e deriva `texto_md`. Rodar → falha.
- [ ] **Step 4:** Implementar `salvarLinhas` com upsert idempotente. Validar o rig por mutação (quebrar de propósito). Rodar → passa.
- [ ] **Step 5:** Montar `Editor.tsx` (BlockNote, locale `pt`, tema Obsidian+Jade via `roadmapmind.css`), portando do protótipo. `RoadMapMind.tsx` carrega via `carregarDocumento`, monta blocos, e num `onChange` debounced (~800ms) chama `PUT /api/docs` (autosave) + botão "Salvar" manual + status de sync.
- [ ] **Step 6:** `bun run typecheck && lint && test`; commit.

**Critérios de aceite:**
- Digitar no editor, recarregar a página, o conteúdo persiste (ids estáveis).
- Salvar 2× seguidas não cria linhas duplicadas (upsert idempotente).
- `texto_md` no banco reflete o texto da linha após salvar.
- Status mostra "Sincronizado" após autosave e "Salvando…" durante.

---

### Task 2: Outline rico (paridade com o protótipo 05)

**Files:** Modify `Editor.tsx`, `roadmapmind.css`; Create `src/app/docs/Editor.e2e-notes.md` (checklist de aceite manual).

**Interfaces:** Consumes Task 1.

- [ ] **Step 1:** Guias de indentação **uma cor por nível** (azul-acinzentado → areia → verde-sálvia → lilás → rosé, opacidade 0.65) via CSS (portar do protótipo).
- [ ] **Step 2:** Modo numerado 1.1.1 por CSS counters (`!important` sobre o bullet interno). **Regra da spec: checkboxes NÃO entram na numeração** — só texto/bullet contam (decisão do dono, ticket 05).
- [ ] **Step 3:** Dobrar/expandir linha com filhas clicando no marcador (hover mostra `⌄`; dobrado vira `›` jade).
- [ ] **Step 4:** Menu "/" em PT-BR (locale `pt`) com visual TinDo; respiro de 45vh no rodapé pro menu não cortar. Toolbar flutuante nativa (B/I/U/S, link, cor, destaque). Blocos de código (`tipo='codigo'`).
- [ ] **Step 5:** Colar markdown → árvore (`tryParseMarkdownToBlocks`); confirmar que salva como linhas.
- [ ] **Step 6:** `typecheck && lint && test`; commit.

**Critérios de aceite (manuais, checklist no `.e2e-notes.md`):** cada nível tem cor de guia distinta · números 1.1.1 corretos e tarefas não numeram · dobrar esconde filhas · "/" abre menu pt-BR · colar um markdown de 3 níveis vira árvore correta e persiste.

---

### Task 3: Tarefas hierárquicas

**Files:** Modify `Editor.tsx`, `src/services/doc.ts`; Create testes de `concluirTarefa`.

**Interfaces:** Consumes RPC `concluir_tarefa` (Task 0).

- [ ] **Step 1 (test first):** Teste de `concluirTarefa`: chamar sem forçar com filha-tarefa aberta → erro `TAREFA_TEM_FILHAS_ABERTAS`; com forçar → todas viram `concluida`. (Teste de integração contra branch Supabase, ou unit mockando a RPC + um teste SQL via `execute_sql` na branch.) Rodar → falha.
- [ ] **Step 2:** Ligar checkbox do BlockNote → `tipo='tarefa'`, `tarefa_estado`. Ao concluir um pai, chamar `concluirTarefa(id)`; se erro de filhas abertas, abrir modal de confirmação "concluir tudo?" e re-chamar com `forcar=true`. Mostrar progresso (ex.: 3/5) no pai. Rodar teste → passa.
- [ ] **Step 3:** Item concluído fica riscado + checkbox preenchido (jade). Pai travado (não deixa marcar) até filhas fecharem, salvo cascata confirmada.
- [ ] **Step 4:** `typecheck && lint && test`; commit.

**Critérios de aceite:** marcar pai com filha aberta abre aviso; confirmar fecha a subárvore atômica; progresso do pai atualiza; recarregar mantém estados.

---

### Task 4: Mapa — visualização e sincronia (React Flow)

**Files:** Create `src/app/docs/Mindmap.tsx`; Modify `RoadMapMind.tsx` (3 modos + divider), `useDocStore.ts` (modo, colapso, seleção).

**Interfaces:** Consumes as linhas carregadas + seleção do editor. Produces o store de estado da tela.

- [ ] **Step 1:** Portar `Mindmap.tsx` do protótipo: React Flow com raiz virtual (nome do usuário), layout tidy custom (o do protótipo; d3-hierarchy é plano B se precisar), cores por nível = paleta das guias (painel 🎨; "automático" default), orientação ⇄/⇅.
- [ ] **Step 2:** Sync a cada tecla: `onChange` do editor recalcula nós/arestas (throttle). Linha vazia já vira nó "…" (zoom não pula).
- [ ] **Step 3:** Colapso por alça pendurada com **badge de contagem** de descendentes; focus mode (isola nó + descendentes, `fitView` no subconjunto — engolir a Promise rejeitada do `fitView`); zoom por nível.
- [ ] **Step 4:** Sincronia bidirecional: cursor no editor → borda no nó; clicar nó → leva à linha. Nós recém-editados destacados.
- [ ] **Step 5:** 3 modos (Documento / Lado a lado / Mapa) + divisor arrastável com grip `⋮⋮`; controles +/−/fit.
- [ ] **Step 6:** `typecheck && lint && test`; commit.

**Critérios de aceite:** mapa reflete a edição em tempo real · colapsar mostra contagem · focar isola o ramo · clicar nó seleciona a linha · alternar os 3 modos e arrastar o divisor funciona.

---

### Task 5: Mapa — edição (criar/mover/editar pelo mapa)

**Files:** Modify `Mindmap.tsx`, `src/services/doc.ts` (usa `moverLinha`).

**Interfaces:** Consumes RPC `mover_linha` (Task 0).

- [ ] **Step 1 (test first):** Teste de `moverLinha`: mover para dentro da própria subárvore → erro `CICLO`; mover válido atualiza `pai_id`+`ordem` preservando o id. Rodar → falha.
- [ ] **Step 2:** Duplo clique = edição inline no nó (textarea; Shift+Enter quebra linha, refletida); menus bloqueados durante edição; dica no rodapé só durante edição. Persistir via `salvarLinhas`.
- [ ] **Step 3:** Menu de ações do nó com atalhos: Enter = filha · Shift+Enter = irmã · Delete = excluir (confirmação se houver descendentes) · voltar ao lugar · reorganizar só as filhas. Nó novo nasce em edição com zoom nele + na mãe. **Preservar id via `moverLinha`** (não clonar como no protótipo).
- [ ] **Step 4:** Arrastar: solto perto de outro nó = vira filho (alvo pulsa jade tracejado; anima posições) via `moverLinha`; solto longe = posição manual. Rodar teste → passa.
- [ ] **Step 5:** `typecheck && lint && test`; commit.

**Critérios de aceite:** criar/editar/mover pelo mapa persiste no banco com id preservado · mover pra dentro de si mesmo é bloqueado com mensagem pt-BR · excluir nó com filhos pede confirmação.

---

### Task 6: Documentos aninhados + menu lateral

**Files:** Create `src/app/docs/MenuDocumentos.tsx`; Modify `RoadMapMind.tsx`, `page.tsx` (aceita `?doc=<uuid>`), `useDocStore.ts`.

- [ ] **Step 1:** `MenuDocumentos.tsx`: árvore só de linhas **que têm filhas** ("documentos"); setas `›` rotativas; 1º item = nome do usuário (raiz). Recolhível (`☰`).
- [ ] **Step 2:** Focar um documento isola editor **e** mapa (ancestrais somem); a linha focada vira o título da página. **Regra da spec: níveis internos sobem de hierarquia no foco** (H3→H2 etc.).
- [ ] **Step 3:** Deep-link: `/docs?doc=<uuid>` abre já focado nesse documento; navegar pelo menu atualiza a URL (via `<Link href>` real — `src/CLAUDE.md`).
- [ ] **Step 4:** `typecheck && lint && test`; commit.

**Critérios de aceite:** menu lista só linhas com filhas · escolher um foca editor+mapa e muda o título · `/docs?doc=<uuid>` abre focado · recolher/expandir o menu funciona.

---

### Task 7: Espelhos (múltiplas mães) — ÚLTIMA fatia, adiável

**Files:** Create `supabase/migrations/20260730000002_roadmapmind_espelhos.sql`; Modify `doc.ts` (criar/remover espelho, estender export/mover), `Mindmap.tsx`, `Editor.tsx`.

- [ ] **Step 1:** Aplicar migration `doc_espelhos` (SQL da seção Data Model — cérebro). Estender `mover_linha` e `documento_como_markdown` para considerar espelhos (ciclo via espelhos; markdown marca o espelho e corta recursão por visitados).
- [ ] **Step 2 (test first):** Teste: criar espelho de uma linha sob outra mãe → `documento_como_markdown` mostra a linha 2× com marcação; editar a original reflete no espelho (mesmo `linha_id`). Rodar → falha.
- [ ] **Step 3:** Service `criarEspelho(linhaId, maeId, ordem)` / `removerEspelho(id)` (soft delete só em `doc_espelhos`). Rodar teste → passa.
- [ ] **Step 4:** UI: criar espelho = arrastar nó com **Alt** (mapa) ou comando "/espelhar em…" (editor). Espelho sinalizado com ícone `↻` discreto no editor e no mapa; aresta pontilhada no mapa. Apagar original → aviso "esta linha tem N espelhos" com opções (apagar tudo / promover um espelho).
- [ ] **Step 5:** `typecheck && lint && test`; commit.

**Critérios de aceite:** espelhar uma linha faz ela aparecer nos dois lugares como a mesma (editar reflete) · ciclo por espelho é bloqueado · apagar espelho ≠ apagar linha · apagar original avisa.

> **Adiável:** se o dono quiser lançar antes, esta fatia sai para "Fase 1.5". A `doc_linhas` e as RPCs base não dependem dela; nenhuma fatia anterior a referencia.

---

### Task 8: Entrada no menu do TinDo + polish + mobile mínimo

**Files:** Modify o componente de navegação do TinDo (`src/components/*` — `Sidebar.tsx`/`BottomNav.tsx`), `RoadMapMind.tsx`, `roadmapmind.css`.

- [ ] **Step 1:** Adicionar item "RoadMapMind" (`/docs`, ícone lucide) na navegação do TinDo via `<Link href>` real.
- [ ] **Step 2:** Empty state (doc vazio) com CTA; skeleton só no 1º load (`if (loading && linhas.length === 0)`); tema claro/escuro completos.
- [ ] **Step 3:** Mobile: modo simples (documento OU mapa, um por vez); garantir que a tela cheia (overlay sem chrome do TinDo) não quebra <640px.
- [ ] **Step 4:** `typecheck && lint && test`; commit. Deploy Cloudflare Pages (fluxo do repo).

**Critérios de aceite:** `/docs` acessível pelo menu · empty state aparece em doc vazio · mobile mostra um painel por vez sem quebrar · tema claro e escuro corretos.

---

## Riscos e mitigações

- **BlockNote × StrictMode/React 19** → `reactStrictMode:false` + React 19.2 estável + pin Mantine 8.3.11 (Global Constraints). Já validado nos protótipos.
- **Markdown lossy** (BlockNote) → aceito; subset CommonMark+GFM basta para outline. `texto_md` é derivado (não é a fonte — `conteudo` jsonb é).
- **React Flow com milhares de nós** → `onlyRenderVisibleElements` não virtualiza render inicial (issue #3883). Mitigar com subárvores colapsadas desde o dia 1; "grande mapa infinito" fica fora do MVP.
- **`fitView` retorna Promise** → engolir a rejeição (aprendizado do protótipo 06).
- **Auth via service role** → guard de `usuario_id` obrigatório em toda query/RPC no service; nunca confiar só na RLS enquanto o login real não existir.
- **Ordenação fracional** → usar `fractional-indexing`; nunca renumerar irmãos (contrato Fase 3).

## Self-review — cobertura da spec vs tickets

- **01 (inventário/paridade):** editor (Tasks 1–3), mapa (Tasks 4–5), navegação (Task 6), persistência/status (Task 1). Itens marcados "MVP não" no inventário estão na coluna ⏳ do corte. ✓
- **02 (BlockNote):** Global Constraints + Tasks 1–3. ✓
- **03 (React Flow):** Tasks 4–5 + Riscos. ✓
- **04 (schema/RPCs):** seção Data Model + Task 0. ✓
- **05 (protótipo editor):** Task 2 (guias por nível, numeração, "checkboxes não numeram"). ✓
- **06 (protótipo editor+mapa):** Tasks 4–6 (3 modos, foco isola, edição no nó, drag, título=doc, H3→H2 no foco). ✓
- **07 (colaboração Fase 3):** contrato mínimo nas Global Constraints (escrita única em `doc.ts`, ids estáveis, upsert idempotente, nome `doc_yjs_state` reservado). ✓
- **09 (espelhos):** Task 7 + `doc_espelhos` no Data Model. ✓
- **Corte final:** tabela "Corte do MVP", fechado com o dono em 2026-07-30. ✓

**Gaps conhecidos (intencionais, fora do MVP):** botão exportar markdown (RPC pronta, UI depois); visão markdown cru `<>`; alinhamento de texto; «/» massa, grade, modo apresentação, minimap; mapa infinito; mobile caprichado; login real; sync Todoist/cards.
