# TinDo

Aplicativo de produtividade uma-tarefa-por-vez via cards deslizáveis.
IA prioriza, neurociência recompensa, gamificação sustenta o hábito.
Inspirado na UX do Tinder: foco absoluto no item mais importante agora.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 15 (App Router, RSC) |
| Runtime / Package | Bun |
| Linguagem | TypeScript 5.3+ (strict) |
| UI | Tailwind CSS + shadcn/ui |
| Estado client | Zustand |
| Animação | Framer Motion |
| Áudio | Tone.js |
| Backend | Supabase (PostgreSQL 15) + RLS |
| Auth | Supabase Auth |
| PWA | next-pwa |
| Deploy | Cloudflare Pages + Supabase hosted |
| Testes | Vitest + Testing Library |
| Lint/Format | Biome |

## Setup

```bash
# 1. Instalar dependências
bun install

# 2. Variáveis de ambiente
cp .env.example .env.local
# Preencher NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY etc.

# 3. Aplicar migrations do banco
supabase db push
# ou: supabase migration up (se usando CLI local)

# 4. Rodar em desenvolvimento
bun run dev
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `bun run dev` | Servidor de desenvolvimento |
| `bun run build` | Build de produção |
| `bun run start` | Servidor de produção |
| `bun run typecheck` | Verificação de tipos (tsc --noEmit) |
| `bun run lint` | Lint com Biome |
| `bun run test` | Testes com Vitest |
| `bun run test:watch` | Testes em modo watch |

## Estrutura de pastas

```
src/
  app/                  # Rotas Next.js (App Router)
    api/                # Route handlers
    cards/              # Tela principal — fila de cards
    tarefas/            # Lista e detalhe de tarefas
    projetos/           # Gerenciar projetos
    tags/               # Gerenciar tags
    gamificacao/        # Streak, XP, nível, heatmap
    calibracao/         # Wizard de calibração inicial
    configuracoes/      # Abas: Perfil, Scoring, Todoist, IA
    sugestoes-ia/       # Inbox de sugestões da IA
    manifest.ts         # PWA manifest dinâmico
    layout.tsx          # Root layout + metadata
    globals.css         # Design tokens (obsidian + jade)
  components/           # Componentes reutilizáveis
    card/               # TaskCard, SwipeHandler, etc.
  lib/                  # Utilitários sem efeito colateral
    scoring/            # Fórmula nota 0-100
    ai/                 # Prompts e helpers Anthropic
    adiamento/          # Heurística de adiamento
    supabase/           # Singletons client/server
  services/             # Toda I/O com Supabase (regra: componentes não tocam o client diretamente)
  stores/               # Zustand stores
  types/                # Types TypeScript espelhando o schema
supabase/
  migrations/           # Migrations SQL numeradas
docs/                   # Documentação interna (ver abaixo)
public/                 # Assets estáticos e ícones SVG
```

## Fases entregues

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Card swipeable com mock (swipe 4 direções, teclado, celebração) | Concluída |
| 2 | Persistência real + scoring (Supabase, fórmula nota 0-100, CRUD) | Concluída |
| 4 | Gamificação v1 (XP, streak, nível, heatmap, conquistas) | Concluída |
| 5 | Adiamento inteligente (manual + automático com heurística) | Concluída |
| 6 | Calibração inicial (wizard 4 perguntas + persistência) | Concluída |
| 7 | IA — classificação de tarefas (Claude API, tool_use) | Concluída |
| 8 | IA — batch e quebra de tarefas + tela /sugestoes-ia | Concluída |

Ver detalhes e próximas fases em [docs/09_ROADMAP.md](./docs/09_ROADMAP.md).

## Documentacao interna

| Arquivo | Conteudo |
|---------|---------|
| [docs/00_VISAO.md](./docs/00_VISAO.md) | Visao e principios do produto |
| [docs/01_ARQUITETURA.md](./docs/01_ARQUITETURA.md) | Stack e decisoes arquiteturais |
| [docs/02_SCORING.md](./docs/02_SCORING.md) | Formula da nota 0-100 |
| [docs/03_UI_UX.md](./docs/03_UI_UX.md) | Design system, swipe, animacoes, som |
| [docs/04_SCHEMA.md](./docs/04_SCHEMA.md) | Tabelas, RLS, indices |
| [docs/05_TODOIST.md](./docs/05_TODOIST.md) | Sync Todoist |
| [docs/06_GAMIFICACAO.md](./docs/06_GAMIFICACAO.md) | XP, streak, conquistas |
| [docs/07_IA.md](./docs/07_IA.md) | IA — fases, prompts, modelos |
| [docs/08_KPIS.md](./docs/08_KPIS.md) | KPIs e recalibracao |
| [docs/09_ROADMAP.md](./docs/09_ROADMAP.md) | Roadmap por fases |
| [CLAUDE.md](./CLAUDE.md) | Instrucoes para o AI neste projeto |
| [PERGUNTAS_ABERTAS.md](./PERGUNTAS_ABERTAS.md) | Decisoes pendentes |
