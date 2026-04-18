# TinDo

> Produtividade por swipe. IA prioriza, neurociência recompensa, gamificação sustenta.

## Stack

Next 15 · Bun · TypeScript strict · Tailwind + shadcn/ui · Zustand · Framer Motion · Tone.js · Supabase · next-pwa · Cloudflare Pages.

## Como rodar

```bash
# instalar
bun install

# copiar envs e preencher
cp .env.example .env.local

# dev
bun run dev

# typecheck + lint
bun run typecheck
bun run lint
```

## Documentação interna

- [CLAUDE.md](./CLAUDE.md) — regras para o AI no projeto
- [docs/00_VISAO.md](./docs/00_VISAO.md) — visão do produto
- [docs/01_ARQUITETURA.md](./docs/01_ARQUITETURA.md) — stack, estrutura
- [docs/02_SCORING.md](./docs/02_SCORING.md) — fórmula da nota 0-100
- [docs/03_UI_UX.md](./docs/03_UI_UX.md) — design, swipe, som
- [docs/04_SCHEMA.md](./docs/04_SCHEMA.md) — tabelas, RLS
- [docs/05_TODOIST.md](./docs/05_TODOIST.md) — sync bidirecional
- [docs/06_GAMIFICACAO.md](./docs/06_GAMIFICACAO.md) — XP, streak, conquistas
- [docs/07_IA.md](./docs/07_IA.md) — IA incremental
- [docs/08_KPIS.md](./docs/08_KPIS.md) — métricas e recalibração
- [docs/09_ROADMAP.md](./docs/09_ROADMAP.md) — fases 0-12
- [PERGUNTAS_ABERTAS.md](./PERGUNTAS_ABERTAS.md) — pendências do humano
