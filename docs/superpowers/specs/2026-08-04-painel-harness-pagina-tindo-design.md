# Painel do Harness como página do TinDo (com atualização periódica)

> Design aprovado pelo dono em 2026-08-04. Transforma o Artifact estático do
> Painel do Harness numa página viva do TinDo (`/harness`), com dados
> atualizados de hora em hora e filtro de período (dia/semana/15d/mês).

## Problema

O Painel do Harness vive hoje como **Artifact do Claude** (URL
`b204e86f-...`), gerado por `~/.claude/orquestracao/painel.mjs` a partir de
arquivos **locais** da máquina do dono. Artifacts são estáticos: os números
congelam no momento da publicação. Além disso, a comparação é fixa em
**semana com semana** — o dono quer poder comparar **dia×dia, semana×semana,
15d×15d e mês×mês**.

## Objetivo

Uma página `/harness` no TinDo, atrás do login, que:
1. Mostra os mesmos 6 blocos do painel atual, fiéis em conteúdo.
2. Atualiza sozinha — dados no máximo ~1h atrasados.
3. Tem um **filtro de período** no topo (`Dia · Semana · 15 dias · Mês`) que
   recalcula os KPIs comparáveis e mostra a variação **período atual vs
   período anterior de mesmo tamanho** (janela rolante).

Fora de escopo: o Hub do Sync (segundo artefato) — fatia futura, decisão do
dono foi "painel primeiro, hub depois".

## Fonte de dados — o desafio central

`painel.mjs` lê **três** fontes, todas locais:
- `~/.claude/orquestracao/ledger.jsonl` — 1 linha por despacho:
  `{ ts, frente, modelo, effort, terreno, resultado, tarefa, nota, dur }`.
  **É o coração** — todos os KPIs comparáveis saem daqui.
- `~/.claude/orquestracao/kpi-history.jsonl` — snapshots semanais.
- **git + `gh`** dos repos SeuCamarão e Tindo — volume de código (linhas +/−
  por semana) e velocidade de PRs (mergeados/semana, lead mediano).

Uma página na Cloudflare **não alcança** a máquina local. Logo: um
**empurrador local** roda na máquina do dono, lê as três fontes, monta um
blob JSON e faz upsert numa tabela do Supabase do TinDo. A página lê a tabela
e renderiza.

Decisão-chave: o empurrador manda o **ledger cru** (últimos 90 dias), não
KPIs pré-agregados. É isso que permite ao filtro de período recalcular
qualquer janela **no cliente**. Já o volume de código e os PRs (que dependem
de git/gh) vão **pré-computados** no blob — a página só os desenha.

## Arquitetura

```
Máquina do dono (launchd, 1×/hora)
  publicar-painel.mjs
    ├─ lê ledger.jsonl (cru, últimos 90d)
    ├─ lê kpi-history.jsonl
    ├─ roda git log (volume) + gh pr list (PRs) → pré-computa
    ├─ carrega config (assinaturas, cadeias por terreno)
    └─ upsert → Supabase.harness_snapshot (service_role)
                          │
                          ▼
TinDo (Cloudflare)  GET /harness  (atrás do login)
  page.tsx → getHarnessSnapshot() (service) → lê blob
    └─ lib/harness/kpis.ts recalcula KPIs pro período escolhido
       + comparação atual vs anterior → render dos 6 blocos
```

### Componente 1 — Tabela `harness_snapshot` (Supabase TinDo)

Singleton (uma linha só). Dado de orquestração do dono, não é dado
multi-usuário — sem `usuario_id`.

```sql
create table public.harness_snapshot (
  id         text primary key default 'singleton'
             constraint harness_snapshot_singleton check (id = 'singleton'),
  dados      jsonb not null,
  gerado_em  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.harness_snapshot enable row level security;
-- Leitura: qualquer usuário autenticado (TinDo é single-user hoje; se virar
-- multi-user, restringir ao uuid do dono). Escrita: só service_role (empurrador).
create policy harness_snapshot_read on public.harness_snapshot
  for select to authenticated using (true);
```

Sem policy de INSERT/UPDATE para `authenticated` → escrita só pelo empurrador
(service_role ignora RLS). Trigger `set_updated_at` se já existir no schema;
senão o empurrador seta `gerado_em`/`updated_at` no upsert.

**Formato do blob `dados`:**
```jsonc
{
  "gerado_em": "2026-08-04T12:00:00Z",
  "ledger": [ { "ts": "...", "frente": "codex", "modelo": "gpt-5.6-luna",
    "effort": "max", "terreno": "rotina", "resultado": "ok1",
    "tarefa": "...", "dur": 25 } /* ...últimos 90d */ ],
  "history": [ /* linhas de kpi-history.jsonl */ ],
  "volume_codigo": [ { "nome": "SeuCamarão",
    "semanas": [ { "s": 3, "add": 1200, "del": 300 }, /* s=2,1,0 */ ] } ],
  "prs": [ { "s": 3, "prs": 12, "leadMin": 45 }, /* s=2,1,0 */ ],
  "assinaturas": [ { "nome": "Anthropic (Claude)", "frente": "claude",
    "valor": 200, "renova": "2026-08-22", "papel": "..." } ],
  "cadeias": { "rotina": { "rotulo": "...", "default": "...",
    "fallback": [], "piso": true, "revisor": "..." } /* ... */ }
}
```

`assinaturas` e `cadeias` viajam no blob (fonte única = o empurrador, que
espelha o `~/.claude/CLAUDE.md`). A página só renderiza — não duplica config.

### Componente 2 — Empurrador local `publicar-painel.mjs`

Vive em `~/.claude/orquestracao/` ao lado de `painel.mjs` (config pessoal, não
versionada no repo do app). Reaproveita a lógica de leitura já existente:
- `lerJsonl`, `janela` — cru do ledger/history.
- `volumeCodigo` (git log --numstat) e `prVelocidade` (gh pr list) — idênticas
  às de `painel.mjs`.
- Constantes `CADEIAS` e `ASSINATURAS` — copiadas de `painel.mjs` (mesma fonte).

Credenciais: lê `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do
`.env.local` do TinDo (`/Users/maiaemanuel/Apps YaaX/tindo/.env.local`).
Upsert via REST PostgREST (`POST .../harness_snapshot` com
`Prefer: resolution=merge-duplicates`) ou `@supabase/supabase-js`.

Ledger cru limitado a 90 dias (folga sobre o maior filtro: mês vs mês = 60d).

### Componente 3 — Service + lib de cálculo (TinDo)

`src/services/harness.ts`:
```ts
export async function getHarnessSnapshot(): Promise<HarnessSnapshot | null>
```
Lê a linha singleton via client Supabase (padrão do projeto: componentes não
tocam o client direto; tudo por service).

`src/lib/harness/kpis.ts` — **porta pura e testada** da lógica de
`ledger.mjs`/`painel.mjs`, agora parametrizada por janela:
- `kpisGerais(linhas)` → qualidade (ok1), economia (offload/custo), quota,
  retrabalho, durMed.
- `kpisTerreno(linhas, cadeias)` → por terreno + sinal (subir/baratear/quota).
- `porModelo(linhas)` → chamadas por modelo+effort.
- `custoAssinaturas(linhas, assinaturas, janelaDias)` → custo/tarefa + veredito.
- `recorte(ledger, janelaDias, deslocamento)` → filtra a janela (0 = atual,
  1 = período anterior). Base para o Δ.

Testes co-locados `kpis.test.ts` cobrindo os KPIs contra amostras fixas
(garantia de que a porta bate com os números do `ledger.mjs` original).

### Componente 4 — Página `/harness`

`src/app/harness/page.tsx` (+ componentes em `src/app/harness/_components/` ou
`src/components/harness/`). Client component (interativo pelo filtro).

**Filtro de período** (topo): botões `Dia (1d) · Semana (7d) · 15 dias ·
Mês (30d)`. Estado local. Semântica: **janela rolante** — "Semana" = últimas
168h vs as 168h anteriores. Amostra pequena (ex. "Dia") mostra honestamente
"pouco dado" nos sinais.

**Os 6 blocos:**
1. **Como estamos** — tiles Qualidade, Economia, Quota, Retrabalho.
   Cada tile: valor no período + **Δ vs período anterior** (▲/▼ + diferença),
   cores de status. SEGUE o filtro.
2. **Fluxo de entrega (GitHub)** — Entregas (PRs) e Tempo de merge. Vêm do
   `gh`, são **semanais fixos** (não seguem o filtro): semana atual vs
   anterior + série de 4 semanas. Sub-rótulo deixa claro que é base semanal.
3. **Por terreno** — titular/fallback/sinal por terreno. SEGUE o filtro.
4. **Chamadas por modelo** — barras por modelo+effort. SEGUE o filtro.
5. **Assinaturas** — custo/tarefa proporcional ao período + veredito. SEGUE.
6. **Volume de código** e **Histórico** — longo prazo, **fixos** (4 semanas /
   snapshots). Não seguem o filtro.

**Visual:** identidade do TinDo (Obsidian dark + Jade), não as cores do
Artifact. Popovers "i" de explicação (leigo) preservados — o dono depende
deles. Responsivo, tabela com scroll horizontal próprio.

## Fatias (PRs incrementais, política DORA do TinDo)

**Fatia 1 — Fundação de dados** (1 PR no TinDo + script local):
- Migration `harness_snapshot` + RLS.
- `src/services/harness.ts` + tipos em `src/types/`.
- Empurrador `~/.claude/orquestracao/publicar-painel.mjs`.
- 🔴 Aplicar a migration em prod exige OK do dono (regra do TinDo). Rodar o
  empurrador 1× para popular.

**Fatia 2 — Página** (1 PR no TinDo):
- `src/lib/harness/kpis.ts` + testes (porta da lógica).
- `src/app/harness/page.tsx` + componentes + filtro de período.
- Prova visual no preview antes do merge.

**Fatia 3 — Automação** (local, sem PR):
- launchd `com.seucamarao.publicar-painel.plist`, de hora em hora.

## Critérios de aceite

- Página `/harness` acessível logado; nega deslogado.
- Os 6 blocos batem com o `painel.mjs` atual para a janela de 7 dias.
- Filtro troca período e recalcula os blocos comparáveis; cada tile mostra Δ
  correto vs período anterior.
- Dado no máximo ~1h atrasado depois que a Fatia 3 estiver ativa.
- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run cf:build`
  verdes. `kpis.test.ts` cobre os KPIs.

## Riscos

- **Fidelidade da porta**: os KPIs em `kpis.ts` precisam bater com
  `ledger.mjs`. Mitigação: testes com amostras fixas.
- **RLS single-user**: leitura liberada a `authenticated`. Aceitável enquanto
  o TinDo é single-user; nota registrada para restringir se virar multi-user.
- **Tamanho do blob**: ledger 90d = poucos KB. Sem problema.
- **Amostra pequena no filtro "Dia"**: KPIs oscilam. Tratado exibindo "pouco
  dado" nos sinais — comportamento honesto, não bug.
</content>
</invoke>
