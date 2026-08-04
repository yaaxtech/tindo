# DEPLOY — TinDo em Cloudflare Pages

Domínio oficial: **https://tindoapp.pages.dev**

---

## Primeira vez (setup local)

```bash
# 1. Instalar dependências
bun install

# 2. Build local (gera o bundle em .open-next/assets)
bun run cf:pages:build

# 3. Deploy manual (requer CLOUDFLARE_API_TOKEN exportado)
export CLOUDFLARE_API_TOKEN=<seu-token>
bunx wrangler pages deploy .open-next/assets --project-name=tindoapp --branch=main
```

---

## Secrets — CF Pages Dashboard

Acesse: https://dash.cloudflare.com → Pages → tindoapp → Settings → Environment Variables

| Secret | Descrição |
|--------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (server-only) |
| `TODOIST_API_TOKEN` | Token da API do Todoist |
| `ANTHROPIC_API_KEY` | Chave da API da Anthropic |
| `TINDO_MVP_USER_ID` | UUID do usuário único no Supabase Auth |
| `CRON_SECRET` | Segredo para autenticar o cron worker |

Gerar CRON_SECRET:
```bash
openssl rand -hex 32
```

---

## GitHub Actions (CI/CD automático)

O push em `main` dispara `.github/workflows/ci.yml`. Depois dos testes e do build,
o mesmo job prepara o bundle e publica o projeto `tindoapp` no Cloudflare Pages.

### Secrets necessários no GitHub

Acesse: Settings → Secrets → Actions

| Secret | Descrição |
|--------|-----------|
| `CLOUDFLARE_API_TOKEN` | Token da Cloudflare (permissão Pages:Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID da Cloudflare |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase (usado no build) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon (usada no build) |

---

## Cron diário (06:00 UTC / 03h BRT)

CF Pages NÃO suporta cron triggers nativos. A solução é um Worker separado:

```bash
cd cf-worker-cron

# Setar o segredo
wrangler secret put CRON_SECRET
# (cole o mesmo valor usado nas envs do Pages)

# Deploy do worker
wrangler deploy
```

O Worker `tindo-cron` irá chamar `POST https://tindoapp.pages.dev/api/cron/diario`
com o header `Authorization: Bearer <CRON_SECRET>` diariamente.

**Alternativa sem Worker**: use https://cron-job.org ou UptimeRobot apontando para
`https://tindoapp.pages.dev/api/cron/diario` (POST, com header Authorization).

---

## Caveats CF Pages + Next.js 15

### Middleware
O middleware atual (`src/middleware.ts`) usa `@supabase/ssr` com cookies — roda em
Edge runtime e é compatível com CF Pages via `nodejs_compat`.

Se o build falhar com erro de middleware, adicione ao topo do arquivo:
```ts
export const runtime = 'edge';
```

### next-pwa (`@ducanh2912/next-pwa`)
PWA gera service worker estático — compatível com CF Pages sem adaptação.

### API routes com `runtime = 'nodejs'`
O endpoint `/api/cron/diario` usa `export const runtime = 'nodejs'` pois precisa
de `@supabase/supabase-js` (que usa fetch nativo). CF Pages suporta isso via
`nodejs_compat`.

### Rotas com streaming / RSC
Se alguma RSC falhar no build com erro de Edge API não suportada, adicione ao
page/layout em questão:
```ts
export const runtime = 'nodejs';
// ou
export const dynamic = 'force-dynamic';
```

---

## Scripts disponíveis

| Script | Descrição |
|--------|-----------|
| `bun run cf:pages:build` | Build OpenNext e prepara o bundle do Pages |
| `bunx wrangler pages deploy .open-next/assets --project-name=tindoapp --branch=main` | Deploy do bundle já preparado |
| `bun run build` | Build Next.js padrão (Node.js) |
