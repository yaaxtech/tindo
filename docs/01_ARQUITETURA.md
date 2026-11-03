# 01 — Arquitetura e Stack

## Stack travada

| Camada | Tecnologia | Por quê |
|--------|-----------|---------|
| Framework | Next.js 16 (App Router) | RSC, streaming, roteamento mature, deploy Cloudflare nativo |
| Runtime / Package | Bun | Rápido, install rápido, é o que o usuário usa |
| Linguagem | TypeScript 5.3+ strict | Sem gambiarra runtime; tipos servem de documentação |
| UI kit | shadcn/ui + Tailwind | Componentes baixo-nível, customizáveis, sem lock-in |
| Estado client | Zustand | Simples, sem boilerplate, persist plugin para PWA |
| Animação | Framer Motion | Gestos de swipe, drag, spring physics |
| Áudio | Tone.js | Síntese programática (sem assets .mp3 iniciais) |
| Backend | Supabase (Postgres 15) | Auth, RLS, storage, Realtime, tudo integrado |
| Auth | Supabase Auth (Magic Link email inicial) | Fricção zero, sem senhas |
| PWA | next-pwa | Instalável, offline-first no cache |
| Deploy frontend | Cloudflare Pages | Free tier generoso, edge global, PR previews |
| Deploy BD | Supabase hosted | Projeto `jtpfauouvbtmhgrszybk` já criado |
| Testes | Vitest + Testing Library | Rápido, compatível com TS strict |
| Lint / Format | Biome | Unificado (lint+format), mais rápido que ESLint+Prettier |
| Monorepo | NÃO (single-package Next) | YAGNI — sem razão para monorepo ainda |
| Observabilidade | Sentry (opcional, fase posterior) | Só quando sair de beta |

## Estrutura de pastas proposta

```
tindo/
├── CLAUDE.md                    # regras para o AI
├── README.md                    # setup, como rodar
├── PERGUNTAS_ABERTAS.md         # decisões pendentes do humano
├── package.json
├── bun.lockb
├── next.config.mjs              # inclui next-pwa
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── biome.json
├── vitest.config.ts
├── .env.example                 # template
├── .env.local                   # real (gitignored)
├── .gitignore
├── .claude/                     # configs específicas do Claude Code
│   └── settings.local.json
├── docs/                        # documentação (esta pasta)
│   └── ...
├── supabase/
│   ├── migrations/              # SQL versionado
│   ├── seed.sql                 # dados de dev
│   └── config.toml              # config CLI Supabase
├── public/
│   ├── icons/                   # PWA icons
│   ├── manifest.json            # PWA
│   └── sounds/                  # futuramente (sons tonais)
├── src/
│   ├── app/                     # Next App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── cadastro/
│   │   ├── (app)/               # grupo protegido (com layout shell)
│   │   │   ├── layout.tsx
│   │   │   ├── cards/           # home: card swipeable
│   │   │   ├── tarefas/
│   │   │   ├── projetos/
│   │   │   ├── tags/
│   │   │   ├── gamificacao/
│   │   │   ├── conquistas/
│   │   │   ├── calibracao/
│   │   │   └── configuracoes/
│   │   └── api/
│   │       ├── todoist/
│   │       │   ├── webhook/route.ts
│   │       │   └── sync/route.ts
│   │       └── ai/
│   │           └── classificar/route.ts
│   ├── components/
│   │   ├── ui/                  # shadcn (auto-gerado via CLI)
│   │   ├── card/
│   │   │   ├── TaskCard.tsx
│   │   │   ├── SwipeHandler.tsx
│   │   │   ├── CardFront.tsx
│   │   │   ├── CardBack.tsx
│   │   │   └── AdiamentoNivel2.tsx
│   │   ├── celebration/
│   │   │   ├── CompletionCelebration.tsx
│   │   │   └── ConfettiBurst.tsx
│   │   ├── gamification/
│   │   │   ├── StreakBadge.tsx
│   │   │   ├── XpBar.tsx
│   │   │   └── Heatmap.tsx
│   │   ├── calibracao/
│   │   │   └── SliderPreocupacao.tsx
│   │   └── layout/
│   │       ├── AppShell.tsx
│   │       ├── MobileBottomNav.tsx
│   │       └── DesktopSidebar.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        # createBrowserClient
│   │   │   └── server.ts        # createServerClient
│   │   ├── audio/
│   │   │   └── tones.ts         # factory de notas Tone.js
│   │   ├── scoring/
│   │   │   ├── engine.ts        # cálculo nota 0-100
│   │   │   └── normalizers.ts
│   │   ├── todoist/
│   │   │   ├── client.ts        # fetch wrapper
│   │   │   ├── mapper.ts        # todoist ↔ tindo schema
│   │   │   └── sync.ts          # orquestra pull/push
│   │   └── ai/
│   │       ├── claude.ts        # SDK Anthropic
│   │       └── prompts.ts
│   ├── services/
│   │   ├── tarefas.ts
│   │   ├── lembretes.ts
│   │   ├── projetos.ts
│   │   ├── tags.ts
│   │   ├── gamificacao.ts
│   │   ├── calibracao.ts
│   │   ├── historico.ts
│   │   ├── todoist.ts
│   │   └── ai.ts
│   ├── stores/
│   │   ├── cardStack.ts
│   │   ├── gamificacao.ts
│   │   └── config.ts
│   ├── hooks/
│   │   ├── useKeyboardNav.ts
│   │   ├── useSwipe.ts
│   │   └── useCompletionCelebration.ts
│   ├── types/
│   │   ├── database.ts          # gerado via `supabase gen types`
│   │   └── domain.ts            # tipos de domínio (Tarefa, Projeto, etc.)
│   └── styles/
│       └── tokens.css
└── tests/
    └── (espelha src/)
```

## Decisões arquiteturais

### 1. App Router vs Pages Router
**App Router.** RSC reduz JS no cliente, streaming para feedback percebido mais rápido, nested layouts para o shell /(app).

### 2. Edge Functions vs API Routes
- **API Routes (Node)** em `app/api/`: tudo que toca Supabase server-side, já que o SDK é Node-friendly.
- **Edge functions** só se necessário (baixa latência global). Cloudflare Pages Functions (compat Next) pode ser usado em fase posterior.

### 3. Dados server vs client
- **Listas e filtros estáticos**: RSC (Server Component, fetch direto do Supabase com client server-side).
- **Card principal (fila)**: **client component** + Zustand store. Motivo: gestos, animações, undo stack, tudo vive no cliente.
- **Mutações**: server actions ou endpoints em `app/api/`. Preferir server actions onde possível.

### 4. Sync Todoist
- **Estratégia A (MVP)**: polling em `/api/todoist/sync` chamado a cada X min via cron (Cloudflare Workers Cron ou Supabase pg_cron).
- **Estratégia B (v1+)**: webhook do Todoist → `/api/todoist/webhook`.
- Bidirecional com last-write-wins por `updated_at`.

### 5. Offline-first
- next-pwa faz cache de rotas estáticas.
- Operações críticas (concluir, adiar) são otimistas no cliente + fila de sync.
- Fila persiste em `IndexedDB` via Zustand `persist` middleware com serializer customizado.

### 6. Auth
- **Fase 0**: Magic Link via email. Único dispositivo = um usuário. Zero fricção.
- **Fase futura**: OAuth (Google/Apple) + OTP WhatsApp (já usado no SeuCamarão via Z-API — pode reaproveitar).

### 7. Multi-tenant?
- **NÃO no MVP**. Single-user (usuario_id = auth.uid()) já resolve.
- Design do schema já prevê `usuario_id` em todas as tabelas; se virar SaaS, zero migration.

### 8. IA — Claude
- SDK `@anthropic-ai/sdk`.
- Chamadas server-side (não expor API key ao client).
- Cache de resultados idênticos em Supabase `cache_ai_sugestoes`.
- Modelos: Haiku para classificação barata; Sonnet para análise profunda; Opus só quando justificado.
- Prompt caching ativado para templates longos.

## Variáveis de ambiente

`.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=https://jtpfauouvbtmhgrszybk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>    # server-only

# Todoist (preenchido pelo usuário na fase de sync)
TODOIST_API_TOKEN=<token-pessoal>
TODOIST_WEBHOOK_SECRET=<random-gerado>

# Claude / Anthropic (fase IA)
ANTHROPIC_API_KEY=<key>

# Observability (opcional)
SENTRY_DSN=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Observabilidade e logs

- Erros client: `console.error` + futuramente Sentry.
- Erros server (API routes): estruturados em JSON, enviados ao Supabase `logs_erro` (tabela).
- Eventos de uso (concluiu tarefa, adiou, etc.): `historico_acoes` (já é o log).

## Performance — metas

- LCP ≤ 1.5s em mobile 4G.
- Swipe responsivo ≤ 16ms por frame (60fps).
- Tempo de decisão médio (mostrar card → usuário agir): medido, meta <5s.
