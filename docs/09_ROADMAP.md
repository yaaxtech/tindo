# 09 — Roadmap por Fases

> Fases são **entregáveis funcionais**, não arbitrárias. Cada fase termina em um estado testável pelo usuário.

## Fase 0 — Fundação (meta: 1-2 dias)

- [x] Estrutura de docs criada
- [x] CLAUDE.md criado
- [x] Permissões autorizadas
- [ ] Inicializar Next.js 15 + Bun + TypeScript strict
- [ ] Instalar e configurar: Tailwind, shadcn/ui, Biome, Vitest
- [ ] Configurar `next-pwa` (service worker, manifest)
- [ ] Configurar design tokens (obsidian + jade) em `globals.css`
- [ ] Criar Supabase client (browser + server)
- [ ] Escrever migrations (01-09) em `supabase/migrations/`
- [ ] Gerar types do schema (`database.ts`)
- [ ] Setup .env.example + .env.local
- [ ] .gitignore adequado
- [ ] README.md com "como rodar"
- [ ] Commit inicial

**Critério de done**: `bun run dev` abre uma tela de login funcional (mock ou Magic Link), e `bun run typecheck` passa.

## Fase 1 — Card Swipeable com Mock (meta: 2-3 dias) — ✅ DONE

- [x] Componente `TaskCard` com layout completo (obsidian/jade)
- [x] `SwipeHandler` usando Framer Motion (4 direções)
- [x] Threshold visual: feedback de cor durante o drag
- [x] `KeyboardNav` (setas, Space/Enter, E, D, L, N, Esc, Cmd+Z)
- [x] Store Zustand `useCardStackStore` com fila + histórico
- [x] Mock data (20 tarefas fake)
- [x] `CompletionCelebration` — som + confetti + check + +XP ticker
- [x] `AdiamentoNivel2` — 2º nível de swipe funcional
- [x] Shell de navegação (mobile bottom nav, desktop sidebar)
- [x] PWA funcional (instalável)

**Critério de done**: consigo abrir em mobile e desktop, passar por 10 cards usando apenas swipe/teclado, concluir com efeito viciante, e voltar/avançar.

## Fase 2 — Persistência e Scoring (meta: 2 dias) — ✅ DONE

- [x] Serviços `tarefas`, `projetos`, `tags`, `configuracoes` com Supabase real
- [x] `src/lib/scoring/engine.ts` com a fórmula completa + testes
- [x] Triggers PG que recalculam `nota` em update (ou service cuida)
- [x] Tela `/tarefas` (lista + filtros + busca)
- [x] Tela `/projetos` (drag-and-drop ordenação)
- [x] Tela `/tags` (criar com tipo de peso)
- [x] Tela `/configuracoes/scoring` (sliders de w_urg/imp/fac)
- [x] CRUD completo (criar, editar, excluir — soft delete)

**Critério de done**: crio tarefas reais, vejo na fila ordenada pela nota, altero pesos e a fila re-ordena.

## Fase 3 — Sincronização Todoist (meta: 3-4 dias)

- [ ] Input de token em `/configuracoes/todoist`
- [ ] Endpoint `POST /api/todoist/testar` (valida token)
- [ ] Importação inicial (wizard)
- [ ] Mapper `todoist.mapper.ts` + testes com fixtures
- [ ] `POST /api/todoist/sync` — sync bidirecional
- [ ] Cron: pg_cron ou CF Cron a cada 2 min
- [ ] Tratamento de conflitos (last-write-wins + log)
- [ ] Tela de status de sync (última vez, erros)

**Critério de done**: crio tarefa no Todoist mobile, aparece no TinDo em ≤2min. Concluo no TinDo, marca como concluída no Todoist.

## Fase 4 — Gamificação v1 (meta: 2 dias) — ✅ DONE (parcial)

- [x] Tabela `gamificacao` + `conquistas` + triggers
- [x] Service `gamificacao.ts` (XP, streak, conquistas)
- [x] Store Zustand + UI reativa
- [x] Tela `/gamificacao` (streak, XP, nível, heatmap, conquistas)
- [x] StreakBadge no header
- [x] Sons variados + level up fanfare
- [x] Congelador de streak
- [x] Anéis semanais

**Critério de done**: ganho XP ao concluir, subo de nível, streak incrementa, conquistas desbloqueiam com celebração.

## Fase 5 — Adiamento Inteligente (meta: 2 dias) — ✅ DONE

- [x] Adiamento manual persistido via `/api/tarefas/[id]/acao` + `adiamentoCount++`
- [x] Adiamento automático com heurística em `src/lib/adiamento/heuristica.ts`:
  - Buckets: tag+dia, projeto+dia, tag, projeto, dia (≥3 amostras)
  - Fallback inteligente por hora do dia
- [x] Motivo gravado em `adiamento_motivo_auto` + `historico_acoes.dados`
- [x] Toast global com Undo 5s (`Toaster` + `useToasts`) + ação `desfazer_adiamento`
- [x] `AdiamentoNivel2` redesenhado: sugestão destacada + grid 2x3 de presets + accordion custom

**Critério de done**: adio via ↑ e ↓, sistema aprende padrões básicos e sugere horários relevantes.

## Fase 6 — Calibração Inicial de IA (meta: 2 dias) — ✅ DONE

- [x] Wizard `/calibracao` (4 perguntas) — sem LLM ainda, só captura
- [x] Persiste em `configuracoes.criterios_sucesso` via `/api/calibracao`
- [x] Ordenação de projetos (drag-and-drop com @dnd-kit + auto-save)
- [x] Input de Claude API key (aba IA em `/configuracoes`)
- [x] Migration `20260419000001_calibracao_ai.sql` aplicada

**Critério de done**: completo wizard uma vez, respostas salvam, é possível editar.

## Fase 7 — IA Classificação de Tarefas (meta: 3 dias) — ✅ DONE

- [x] SDK Anthropic integrado (`@anthropic-ai/sdk`)
- [x] System prompts em `src/lib/ai/prompts.ts` com caching ephemeral (projetos+tags+critérios)
- [x] `POST /api/ai/classificar` — aceita `tarefaId` OU `{ titulo, descricao, projetoId }`
- [x] `POST /api/ai/testar` — valida chave real via `messages.create` com max_tokens 1
- [x] Service `src/services/ai.ts` usando tool_use `classificar_tarefa`
- [x] Modal `TarefaModal` com botão "Classificar com IA" + explicação exibida
- [x] Aceitar/editar preenchendo sliders + tag_ids automaticamente
- [x] Registro em `sugestoes_ai` quando há `tarefaId`
- [x] Auto-classificação ao criar tarefa (fire-and-forget em POST /api/tarefas + sync Todoist)

**Critério de done**: nova tarefa é classificada automaticamente em ≤3s, posso aceitar/editar.

## Fase 8 — IA Batch e Quebra (meta: 3 dias) — DONE

- [x] `POST /api/ai/batch` — analisa até 20 tarefas sem classificacao em serie
- [x] `POST /api/ai/quebrar` — sugere quebra em sub-tarefas via tool_use
- [x] `GET /api/sugestoes-ai` + `PATCH/DELETE /api/sugestoes-ai/[id]` — inbox CRUD
- [x] Tela `/sugestoes-ia` — inbox elegante com filtros, selecao multipla, aceitar/editar/rejeitar
- [x] Botao "Quebrar em sub-tarefas (IA)" em TarefaModal (modo editar, >50 chars)
- [x] Link "Ver inbox de sugestoes IA" em /configuracoes secao IA
- [x] Prompts `TOOL_QUEBRAR_TAREFA` + `montarPromptQuebra` em prompts.ts

**Critério de done**: seleciono 20 tarefas, IA analisa em 30s, aceito parcial.

## Fase 9 — IA Caminho Crítico (meta: 3 dias) — ✅ DONE

- [x] `/sugestoes` tela Tinder de sugestões com stack de cards
- [x] Sugestão de novas tarefas (swipe right = criar, left = rejeitar, up = editar)
- [x] Prompts `TOOL_SUGERIR_TAREFAS` + `montarPromptSugestoes` com cache ephemeral
- [x] `POST /api/ai/sugerir-tarefas` (gera via IA) + GET (lista pendentes)
- [x] `POST /api/ai/sugerir-tarefas/[id]/resposta` (aceitar/rejeitar)
- [x] Histórico em `sugestoes_ai` tipo `sugerir_nova` com razão

**Critério de done**: IA sugere 5 novas tarefas relevantes ao meu caminho, eu aceito 2 e elas viram cards.

## Fase 10 — Recalibração (meta: 3 dias) — ✅ DONE

- [x] View materializada `kpis_usuario_diario` (migration 20260419000002)
- [x] Função `refresh_kpis_usuario_diario()` invocada via RPC no endpoint de gatilhos
- [x] Detecção de gatilhos (lib/recalibracao/kpis.ts, `detectarGatilhos`)
- [x] `RecalibracaoBanner` flutuante com dismiss 24h localStorage
- [x] Wizard `/recalibrar` 3 passos (diagnóstico + 5 sliders + proposta animada)
- [x] Cálculo de correlação via OLS z-score (lib/recalibracao/correlacao.ts) + testes
- [x] `/api/recalibrar/aplicar` aplica pesos novos + dispara recálculo batch das notas
- [ ] Cron diário de refresh (ainda manual via endpoint — pg_cron/CF Cron pendente)

**Critério de done**: quando KPI passa limiar, app sugere recalibração, eu faço em 60s, pesos e notas atualizam.

## Fase 11 — Polimento + Deploy Produção (meta: 2-3 dias) — parcial

- [ ] Deploy Cloudflare Pages com Preview por PR (precisa credenciais/domínio)
- [x] PWA ícones SVG (icon, apple-touch, favicon, maskable)
- [x] Manifest dinâmico `src/app/manifest.ts` com shortcuts (Cards, IA, Tarefas, Streak)
- [x] OpenGraph + Twitter meta tags
- [x] BottomNav mobile component (pronto para inclusão em shell)
- [x] README reescrito
- [ ] Notificações push (fase posterior)
- [ ] Auditoria de acessibilidade completa (reduzido de 45 → 42 lint errors)
- [ ] Testes e2e com Playwright (fluxos críticos)
- [ ] Performance audit (Lighthouse ≥ 95)

**Critério de done**: app em `tindo.yaax.tech` (ou domínio escolhido), LCP < 1.5s, instalável em iOS/Android/desktop.

## Fase 12+ — Futuro

- Multi-usuário com convites
- Integrações adicionais (Google Tasks, Apple Reminders, Notion)
- Comunidade (comparar KPIs anônimos)
- Modelos fine-tuned por usuário (long term)
- Assistente de voz

## Timebox e replanejamento

- Cada fase deve caber em 1 semana calendário (mesmo que a estimativa em dias seja menor).
- Ao fim de cada fase: retrospectiva rápida, atualizar este doc com reais vs estimado.
- Se uma fase estourar em >50% do estimado, dividir ao invés de alongar.
