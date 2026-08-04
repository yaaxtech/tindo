# Painel do Harness — Página no TinDo — Plano de Implementação

> **For agentic workers:** implemente tarefa por tarefa. Cada tarefa termina
> com deliverable testável e commit. Spec: `docs/superpowers/specs/2026-08-04-painel-harness-pagina-tindo-design.md`.

**Goal:** Página `/harness` no TinDo que mostra os KPIs do harness com dados
atualizados de hora em hora e filtro de período (dia/semana/15d/mês).

**Architecture:** Empurrador local (máquina do dono) lê ledger/git/gh e faz
upsert de um blob JSON numa tabela singleton do Supabase. A página lê o blob e
recalcula os KPIs no cliente para a janela escolhida, com Δ vs período anterior.

**Tech Stack:** Next.js 15 App Router · TypeScript strict · Supabase + RLS ·
Tailwind + identidade Obsidian/Jade · Vitest.

## Global Constraints

- TS `strict: true`; sem `any` sem comentário justificando.
- Acesso Supabase só via `src/services/`; componentes nunca tocam o client.
- Client Supabase via `src/lib/supabase/{client,server,admin}.ts` (singletons).
- Tipos em `src/types/` (snake_case nas colunas, camelCase no domínio).
- Textos de UI em pt-BR, amigáveis; defaults de config comentados em inglês.
- Formatação: 2 espaços, aspas simples, `;`, ~100 chars. Conventional Commits.
- Migration em prod exige OK do dono (🔴) — NÃO aplicar sem OK.
- Números fiéis a `~/.claude/orquestracao/{ledger,painel}.mjs`.

---

## FATIA 1 — Fundação de dados

### Task 1: Migration `harness_snapshot`

**Files:**
- Create: `supabase/migrations/20260804000001_harness_snapshot.sql`

**Passos:**
- [ ] Escrever a migration:

```sql
-- Painel do Harness: snapshot singleton empurrado pela máquina do dono.
-- Dado de orquestração (não multi-usuário) → sem usuario_id.
create table if not exists public.harness_snapshot (
  id         text primary key default 'singleton'
             constraint harness_snapshot_singleton check (id = 'singleton'),
  dados      jsonb not null,
  gerado_em  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.harness_snapshot enable row level security;

-- Leitura: qualquer usuário autenticado (TinDo é single-user hoje).
-- Escrita: só service_role (empurrador) — sem policy de insert/update.
drop policy if exists harness_snapshot_read on public.harness_snapshot;
create policy harness_snapshot_read on public.harness_snapshot
  for select to authenticated using (true);
```

- [ ] Commit: `feat(harness): migration da tabela harness_snapshot`
- [ ] **NÃO aplicar em prod** — aguarda OK do dono (cérebro aplica depois).

### Task 2: Tipos do snapshot

**Files:**
- Modify/Create: `src/types/harness.ts`

**Interfaces (Produces):**
```ts
export interface LedgerLinha {
  ts: string;
  frente: 'codex' | 'kimi' | 'claude' | 'cerebro';
  modelo: string;
  effort: string | null;
  terreno: 'ui' | 'rotina' | 'dificil' | 'mecanico' | 'sql';
  resultado: 'ok1' | 'retrabalho' | 'escalado' | 'falhou' | 'quota';
  tarefa: string;
  nota: string | null;
  dur: number | null;
}
export interface KpiHistoricoLinha {
  ts: string; janela_dias: number; n: number;
  ok1_pct: number | null; offload_pct: number | null;
  quota_hit_pct: number | null; reciclo_pct: number | null;
  dur_mediana_min: number | null; por_frente: Record<string, number>;
  nota: string | null;
}
export interface VolumeRepo {
  nome: string;
  semanas: { s: number; add: number; del: number }[];
}
export interface PrSemana { s: number; prs: number; leadMin: number | null }
export interface Assinatura {
  nome: string; frente: string; valor: number; renova: string; papel: string;
}
export interface CadeiaTerreno {
  rotulo: string; default: string; fallback: string[];
  piso: boolean; nunca_externo?: boolean; revisor: string;
}
export interface HarnessBlob {
  gerado_em: string;
  ledger: LedgerLinha[];
  history: KpiHistoricoLinha[];
  volume_codigo: VolumeRepo[];
  prs: PrSemana[];
  assinaturas: Assinatura[];
  cadeias: Record<string, CadeiaTerreno>;
}
export interface HarnessSnapshot {
  dados: HarnessBlob;
  geradoEm: string;
}
```

- [ ] Commit: `feat(harness): tipos do snapshot`

### Task 3: Service `getHarnessSnapshot`

**Files:**
- Create: `src/services/harness.ts`

**Interfaces:**
- Consumes: `HarnessSnapshot` (Task 2), `createClient` de `@/lib/supabase/client`.
- Produces: `getHarnessSnapshot(): Promise<HarnessSnapshot | null>`

```ts
import { createClient } from '@/lib/supabase/client';
import type { HarnessSnapshot, HarnessBlob } from '@/types/harness';

export async function getHarnessSnapshot(): Promise<HarnessSnapshot | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('harness_snapshot')
    .select('dados, gerado_em')
    .eq('id', 'singleton')
    .maybeSingle();
  if (error || !data) return null;
  return { dados: data.dados as HarnessBlob, geradoEm: data.gerado_em };
}
```

- [ ] Commit: `feat(harness): service getHarnessSnapshot`

### Task 4: Empurrador local `publicar-painel.mjs`

**Files:**
- Create: `~/.claude/orquestracao/publicar-painel.mjs` (fora do repo)

Reaproveita de `painel.mjs`: `lerJsonl`, `janela`, `volumeCodigo`,
`prVelocidade`, e as constantes `CADEIAS`, `ASSINATURAS`, `REPOS`.

**Lógica:**
```js
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
// importa/duplica lerJsonl, janela, volumeCodigo, prVelocidade, CADEIAS,
// ASSINATURAS de painel.mjs (mesma pasta).

function lerEnv(file) { /* parse simples KEY=VALUE do .env.local */ }

const env = lerEnv('/Users/maiaemanuel/Apps YaaX/tindo/.env.local');
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;

const ledger = janela(lerJsonl(LEDGER), 90);   // cru, 90 dias
const history = lerJsonl(HISTORY);
const blob = {
  gerado_em: new Date().toISOString(),
  ledger, history,
  volume_codigo: volumeCodigo(),
  prs: prVelocidade() || [],
  assinaturas: ASSINATURAS,
  cadeias: CADEIAS,
};

const resp = await fetch(`${SUPABASE_URL}/rest/v1/harness_snapshot`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify({ id: 'singleton', dados: blob,
    gerado_em: blob.gerado_em, updated_at: blob.gerado_em }),
});
if (!resp.ok) { console.error('falha upsert', resp.status, await resp.text()); process.exit(1); }
console.log(`painel publicado: ${ledger.length} despachos, gerado_em ${blob.gerado_em}`);
```

- [ ] Testar manualmente rodando `node publicar-painel.mjs` DEPOIS da migration
  aplicada em prod; conferir 200 e a linha no Supabase.

---

## FATIA 2 — Página

### Task 5: Lib de cálculo `kpis.ts` + testes

**Files:**
- Create: `src/lib/harness/kpis.ts`
- Create: `src/lib/harness/kpis.test.ts`

**Interfaces (Produces):**
```ts
export function recorte(ledger: LedgerLinha[], janelaDias: number, desloc: number): LedgerLinha[]
export function kpisGerais(linhas: LedgerLinha[]): KpisGerais
export function kpisTerreno(linhas: LedgerLinha[], cadeias: Record<string, CadeiaTerreno>): Record<string, TerrenoKpi>
export function porModelo(linhas: LedgerLinha[]): ModeloRow[]
export function custoAssinaturas(linhas: LedgerLinha[], assinaturas: Assinatura[], janelaDias: number): AssinaturaCalc[]
```

Porta fiel de `ledger.mjs`/`painel.mjs`. Fórmulas EXATAS (copiar):
- `recorte(ledger, dias, desloc)`: filtra `ts` em
  `[now - (desloc+1)*dias*864e5, now - desloc*dias*864e5)`. `desloc=0` atual,
  `desloc=1` anterior.
- `kpisGerais`: `julg = linhas.filter(r => r.resultado !== 'quota')`;
  `ok1 = julg.filter(r => r.resultado === 'ok1').length / julg.length`;
  `offload = linhas.filter(r => r.frente !== 'claude' && r.frente !== 'cerebro').length / n`;
  `quotaHit = (n - julg.length) / n`;
  `reciclo = julg.filter(r => r.resultado !== 'ok1').length / julg.length`;
  `durMed` = mediana de `dur` positivos dos julgáveis. `porFrente`,
  `quotaPorFrente` como no original.
- `kpisTerreno`: por terreno `{ n, julgaveis, ok1, reciclo, quota }`, depois
  `ok1_pct`, `reciclo_pct`; sinal: `julgaveis<5`→`dados`;
  `ok1_pct<0.70`→`subir`; `ok1_pct>=0.90 && julgaveis>=8 && !cadeia.piso`→
  `baratear`; senão `ok`; `quota>=3`→`quota` (sobrepõe).
- `porModelo`: normaliza modelo (`kimi-code/`→'', `claude-opus-4-8`→'opus-4.8'),
  agrupa por `modelo·effort`, conta `n`, `julg`, `ok1`.
- `custoAssinaturas`: `gasto = valor * janelaDias/30`; `custoSub = uso ? gasto/uso : null`;
  veredito: `quota>0`→aumentar; `uso===0`→cancelar; `custoSub>1.6*custoMedio`→observar; senão manter.

- [ ] Escrever `kpis.test.ts` com uma amostra fixa de ~10 linhas de ledger e
  asserts nos valores exatos de `kpisGerais` e um terreno. Rodar, ver falhar.
- [ ] Implementar `kpis.ts`. Rodar, ver passar.
- [ ] Commit: `feat(harness): lib de cálculo de KPIs + testes`

### Task 6: Página `/harness` + componentes

**Files:**
- Create: `src/app/harness/page.tsx` (client component)
- Create: `src/app/harness/_components/*` (Tiles, FiltroPeriodo, Terreno, Modelos, Assinaturas, Volume, Historico)

**Consumes:** `getHarnessSnapshot` (Task 3), `kpis.ts` (Task 5), tipos (Task 2).

**Comportamento:**
- Carrega o snapshot (via service, em `useEffect` ou server component wrapper
  que passa dados). Se `null`: estado vazio amigável ("ainda sem dados —
  aguardando o primeiro empurrão").
- Estado `janelaDias`: 1 | 7 | 15 | 30 (default 7). Botões no topo.
- `atual = recorte(ledger, janelaDias, 0)`; `anterior = recorte(ledger, janelaDias, 1)`.
- **Bloco 1 (tiles):** Qualidade/Economia/Quota/Retrabalho de `kpisGerais(atual)`
  com Δ vs `kpisGerais(anterior)` (▲/▼ + diferença em pontos). Segue filtro.
- **Bloco 2 (fluxo GitHub):** Entregas (PRs) e Tempo de merge do `blob.prs`
  (semanal fixo, NÃO segue filtro): `prs[3]` (atual) vs `prs[2]` + série 4 sem.
  Sub-rótulo "base semanal".
- **Bloco 3 (terreno):** `kpisTerreno(atual, cadeias)` — titular/fallback/sinal.
- **Bloco 4 (modelos):** `porModelo(atual)` — barras.
- **Bloco 5 (assinaturas):** `custoAssinaturas(atual, assinaturas, janelaDias)`.
- **Bloco 6 (volume + histórico):** `blob.volume_codigo` (4 semanas) e
  `blob.history` (tabela). Fixos.
- Popovers "i" de explicação leiga preservados (copiar textos de `painel.mjs`).
- Visual: Obsidian/Jade (`docs/03_UI_UX.md`), não as cores do Artifact.
  Responsivo; tabela do histórico com `overflow-x:auto`.
- Header mostra `geradoEm` ("atualizado às HH:MM").

- [ ] Rodar `bun run typecheck && bun run lint && bun run test`.
- [ ] Prova visual no preview (dev server) logado.
- [ ] Commit: `feat(harness): página /harness com filtro de período`

---

## FATIA 3 — Automação (local, sem PR)

### Task 7: launchd de hora em hora

**Files:**
- Create: `~/Library/LaunchAgents/com.seucamarao.publicar-painel.plist`

- [ ] Plist com `StartInterval` 3600 chamando
  `node ~/.claude/orquestracao/publicar-painel.mjs`, log em
  `~/.claude/orquestracao/publicar-painel.log`.
- [ ] `launchctl load` e verificar 1 execução.

---

## Self-Review

- **Cobertura da spec:** migration ✓ (T1), service ✓ (T3), empurrador ✓ (T4),
  lib KPIs ✓ (T5), página + filtro + 6 blocos ✓ (T6), automação ✓ (T7),
  tipos ✓ (T2). Blob e RLS cobertos em T1/T2.
- **Placeholders:** fórmulas dos KPIs dadas explícitas em T5; sem TODOs.
- **Consistência de tipos:** `HarnessBlob`/`LedgerLinha` usados em T3/T5/T6
  vêm de T2; nomes batem.
</content>
