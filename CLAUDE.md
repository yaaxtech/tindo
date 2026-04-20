# CLAUDE.md — TinDo

> Fonte de verdade sobre como o AI deve se comportar neste projeto.
> Projeto: **TinDo** (Tinder + ToDo) — app de produtividade com priorização por IA, gamificação e neurociência.

---

## REGRA ZERO

**Consulte os arquivos de `docs/` antes de responder qualquer coisa técnica.**
Não invente, não assuma — verifique. Se não souber, pergunte.
Se houver conflito entre documentos, PARE e avise.

---

## AUTONOMIA — REGRAS DE DECISÃO AUTÔNOMA

> Reduzem input necessário. Siga antes de perguntar.

### Quando NÃO perguntar

| Situação | Ação autônoma |
|----------|---------------|
| Dúvida sobre schema/colunas | Leia `docs/04_SCHEMA.md` e decida |
| Dúvida sobre fórmula de nota | Leia `docs/02_SCORING.md` e decida |
| Dúvida sobre componente UI | Leia `docs/03_UI_UX.md` e decida |
| Dúvida sobre integração Todoist | Leia `docs/05_TODOIST.md` e decida |
| Dúvida sobre fase/prioridade | Leia `docs/09_ROADMAP.md` e decida |
| Task com escopo claro (<3 arquivos) | Execute — sem Plan Mode |
| Typecheck/lint após edição | Rode e corrija sem pedir permissão |
| Mensagem de commit | Analise diff e decida |
| Nome de variável/função | Siga convenções do projeto |

> **Transparência:** ao executar autonomamente, declare premissas no início da resposta.

### Quando perguntar

- Ambiguidade genuína de regra de negócio não coberta nos docs
- Mudança que afeta múltiplos domínios não relacionados
- Ação destrutiva irreversível (drop de tabela, push --force, delete de dados reais)
- Requisito que contradiz algo nos docs internos
- Adição/troca de dependências não previstas na stack

---

## FLUXO DE DESENVOLVIMENTO

1. **Plan Mode** para tarefas complexas (>3 arquivos).
2. **Critérios de verificação antes de implementar** — o que significa "pronto" para esta task (ex: "typecheck passa, card faz swipe, som toca no concluir").
3. Implemente seguindo as regras abaixo.
4. Rode `bun run typecheck` e `bun run lint` antes de commitar.
5. Verifique os critérios definidos no passo 2.
6. Ao finalizar uma feature, atualize o checklist em `docs/09_ROADMAP.md`.

---

## HIERARQUIA DE CONSULTA

| Dúvida sobre... | Consulte |
|----------------|---------|
| Visão e princípios | `docs/00_VISAO.md` |
| Stack e decisões arquiteturais | `docs/01_ARQUITETURA.md` |
| Fórmula de nota 0-100 | `docs/02_SCORING.md` |
| Design system, swipe, animações, som | `docs/03_UI_UX.md` |
| Tabelas, RLS, índices | `docs/04_SCHEMA.md` |
| Sync Todoist | `docs/05_TODOIST.md` |
| Gamificação e neurociência | `docs/06_GAMIFICACAO.md` |
| IA (fases, prompts, modelos) | `docs/07_IA.md` |
| KPIs e recalibração | `docs/08_KPIS.md` |
| Roadmap por fases | `docs/09_ROADMAP.md` |
| Decisões pendentes | `PERGUNTAS_ABERTAS.md` |

---

## STACK (FIXADA — NÃO ALTERAR SEM APROVAÇÃO)

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 15 (App Router, RSC) |
| Runtime / Package | Bun |
| Linguagem | TypeScript 5.3+ (`strict: true` sempre) |
| UI | Tailwind CSS + shadcn/ui |
| Estado client | Zustand |
| Animação | Framer Motion |
| Áudio | Tone.js |
| Backend | Supabase (PostgreSQL 15) + RLS |
| Auth | Supabase Auth |
| PWA | next-pwa |
| Deploy Frontend | Cloudflare Pages |
| Deploy BD | Supabase hosted |
| Testes | Vitest + Testing Library |
| Lint/Format | Biome (ou ESLint+Prettier se Biome não couber) |

**Formatação:** 2 espaços, aspas simples, ponto-e-vírgula sempre, ~100 chars.
**Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

---

## IDENTIDADE VISUAL

- **Base Obsidian** (dark): `#0A0E13` (deep), `#121820` (elevated), `#1B222C` (cards)
- **Jade YaaX** (destaque): `#198B74` (primário), `#2CAF93` (accent vivo)
- **Texto**: `#E8EDF2` (primary), `#7A8796` (secondary), `#4A5563` (muted)
- **Sucesso/Erro/Warn**: jade / `#E3546C` / `#F2B94B`
- Princípios: clean, minimalista, sóbrio, um ponto de cor verde.
- Detalhes completos em `docs/03_UI_UX.md`.

---

## DOMÍNIO DO PROJETO

**TinDo** = produtividade uma-tarefa-por-vez via cards swipeable.

### Conceitos centrais
- **Tarefa**: item de trabalho com importância, urgência, facilidade, tags e projeto. Tem nota 0-100.
- **Lembrete**: item leve (<2min) — SEMPRE concluir ou adiar, nunca pular.
- **Calibração**: processo periódico onde o humano julga N tarefas (slider 0-100) para recalibrar os pesos.
- **Recalibração**: disparada por limiares (% de reavaliação, % de descartes, % de adiamento).

### Fluxo principal
```
Login → Fila priorizada (cards) → Ação (concluir/pular/voltar/adiar) → Próximo card
                                        ↓
                             Sync Todoist (bidirecional)
                                        ↓
                         Recalibração periódica quando KPIs disparam
```

### Swipe / teclado (convenção híbrida — final em 2026-04-20)

**Mobile (swipe)** — segue convenção Tinder:
- **Swipe ESQUERDA (←)**: avançar (próxima)
- **Swipe DIREITA (→)**: voltar (anterior)

**Desktop (teclado)** — segue convenção browser (back/forward):
- **Seta ← (voltar)**: volta para tarefa anterior (equivalente a swipe →)
- **Seta → (avançar)**: avança para próxima (equivalente a swipe ←)

**Ambos**:
- **↑** adiar manual (abre 2º nível)
- **↓** adiar automático (heurística)

**Somente teclado (atalhos de ação)**:
- **q** (ou n) → abre modal de nova tarefa (`e.preventDefault()` obrigatório para não digitar no 1º campo)
- **e** / **E** → editar tarefa atual
- **d** / **D** → excluir tarefa atual
- **Space / Enter** → concluir tarefa atual
- **Ctrl+Z / Cmd+Z** → desfazer último adiamento

A animação visual do card é SEMPRE igual entre swipe e teclado equivalentes: avançar faz carta voar pra esquerda; voltar faz carta voar pra direita.

Histórico: original 2026-04-17 era ←avançar/→voltar. Invertida (B) na manhã 2026-04-20. Revertida Tinder-like na tarde 2026-04-20. Final: mobile Tinder + teclado browser (convenção híbrida).

### Botões do card
- Concluir ✓ (com animação viciante)
- Excluir 🗑
- Dependência 🔗
- Editar ✎
- Adicionar +

---

## REGRAS DE BANCO (PostgreSQL / Supabase)

### Convenções obrigatórias

```sql
-- PK sempre uuid
id uuid PRIMARY KEY DEFAULT gen_random_uuid()

-- Single-user agora; multi-user futuramente via usuario_id
usuario_id uuid NOT NULL REFERENCES auth.users(id)

-- Dinheiro (quando vier): NUNCA float → numeric(12,2)

-- Soft delete
deleted_at timestamptz NULL
-- Toda query: WHERE deleted_at IS NULL

-- Timestamps
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now() -- via trigger set_updated_at()

-- Status/enum: varchar com CHECK, nunca enum PostgreSQL
status varchar(20) NOT NULL
  CHECK (status IN ('pendente','concluida','adiada','excluida'))
```

### RLS
- Toda tabela de usuário: `ALTER TABLE x ENABLE ROW LEVEL SECURITY`
- Policy padrão (cada usuário vê só os próprios dados):
```sql
USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid())
```

---

## REGRAS DE CÓDIGO

- Sem `any` sem comentário justificando
- Supabase client via `src/lib/supabase/{client,server}.ts` (singletons)
- Types em `src/types/` espelhando o schema (snake_case nas colunas, camelCase nos objetos de domínio)
- **Toda leitura/escrita passa por `src/services/`; componentes NÃO tocam o client Supabase diretamente**
- Mensagens de erro em português (PT-BR) para o usuário
- Nenhum texto técnico na UI — tudo amigável
- Testes: co-locados em `*.test.ts(x)` ao lado dos arquivos
- Defaults em arquivos de config: comentados e em inglês; textos de UI: pt-BR

---

## ARQUITETURA FRONTEND

### Rotas (App Router)
```
/                          → redirect /cards (se logado) ou /login
/login                     → Supabase Auth
/cadastro                  → criar conta
/cards                     → tela principal (card swipeable)
/tarefas                   → lista, filtros, busca
/tarefas/[id]              → detalhe (edit)
/projetos                  → gerenciar projetos (ordem + multiplicador)
/tags                      → gerenciar tags (tipo de peso + valor)
/gamificacao               → streak, XP, nível, heatmap
/conquistas                → badges
/calibracao                → wizard inicial e recalibrações
/configuracoes             → abas: Perfil, Scoring, Todoist, IA, Notificações, Privacidade
```

### Camada de serviços (`src/services/`)
- `tarefas.ts`, `lembretes.ts`, `projetos.ts`, `tags.ts`
- `gamificacao.ts`, `calibracao.ts`, `historico.ts`
- `todoist.ts`, `ai.ts`

### Componentes críticos
- `TaskCard` — swipe + keyboard + botões
- `SwipeHandler` — gesto Framer Motion
- `CompletionCelebration` — som + confetti + scale
- `AdiamentoNivel2` — segundo swipe pra adiar manual
- `KpiTile`, `StreakBadge`, `HeatmapGrafico`

### Estado (Zustand)
- `useCardStackStore` — fila atual, índice, histórico
- `useGamificacaoStore` — streak, XP, nível, conquistas
- `useConfigStore` — pesos de scoring, limiares

---

## REGRAS DE NEGÓCIO CRÍTICAS

| ID | Regra |
|----|-------|
| RN-01 | Lembretes nunca podem ser "pulados" — só concluídos ou adiados |
| RN-02 | Soft delete em tudo — `deleted_at`, nunca DELETE físico |
| RN-03 | Nota é sempre recalculada no write (trigger ou service); nunca persistir valor stale |
| RN-04 | Sync Todoist: conflito resolve-se por `updated_at` mais recente (last-write-wins) |
| RN-05 | Concluir sempre toca som + feedback visual (neurociência) |
| RN-06 | Toda ação (concluir, pular, voltar, adiar) registra em `historico_acoes` para IA |
| RN-07 | Recalibração sugerida quando KPI ultrapassa limiar (ver `docs/08_KPIS.md`) |
| RN-08 | Swipe right/left navega SEM alterar status; só adiar/concluir/excluir alteram |
| RN-09 | Dependência: tarefa com dependência não-concluída não entra na fila principal |
| RN-10 | Adiamento automático usa heurística por hora/dia; manual pergunta ao usuário |
| RN-11 | Tarefas concluídas via Todoist API refletem no TinDo em ≤1 min (polling ou webhook) |
| RN-12 | Adiamento automático usa SM-2 adaptado: `base(score) × EF^(n-1)`, ver `docs/11_ADIAMENTO_ESPACADO.md` |
| RN-13 | Mínimo de adiamento = próximo turno (mesmo score 100) |
| RN-14 | Teto de adiamento = 1 dia antes do `prazo_conclusao` às 09:00 |
| RN-15 | Conclusão decai EF em `-0.30` (só da tarefa concluída) |
| RN-16 | Score do adiamento = sempre o atual no momento do cálculo |

---

## NUNCA FAZER

- `any` sem justificativa no comentário
- Armazenar nota 0-100 stale (sem recalcular em updates)
- Acessar `createClient()` do Supabase direto em componentes (sempre via `services/`)
- DELETE físico em dados operacionais
- Commitar `.env.local` ou qualquer token/secret
- Alterar stack (Next/Bun/Supabase/etc) sem aprovação explícita do usuário
- Desabilitar RLS em tabelas com dados de usuário
- Push --force em `main` sem aprovação
