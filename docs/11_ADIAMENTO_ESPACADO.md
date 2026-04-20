# 11 · Adiamento Espaçado (SM-2 adaptado)

Especificação do sistema de adiamento automático baseado em **SM-2 (SuperMemo-2)**
adaptado pra tarefas (não pra memorização). Fonte: conversa de 2026-04-20.

---

## Objetivo

Fazer tarefas adiadas **voltarem no momento certo** — nem cedo demais (usuário
adia de novo), nem tarde demais (perdeu prazo). O sistema aprende por tarefa via
`EF` (easiness factor) e modula pelo `score` 0-100.

**Princípio inverso ao Anki**: no Anki intervalo cresce com sucesso; aqui cresce
com **adiamento** (a tarefa está sendo evitada). Score alto **trava o crescimento**
— tarefa importante não foge.

---

## Fórmula

### 1. Intervalo base (1ª adiada)

| score | 1ª adiada |
|-------|-----------|
| 70-100 | próximo turno |
| 40-69  | amanhã mesmo horário |
| 20-39  | 2 dias |
| 0-19   | 4 dias |

**Turnos** (consistente com `heuristica.ts`):
- Manhã (00:00-11:59) → próximo turno = hoje **14:00**
- Tarde (12:00-16:59) → próximo turno = hoje **19:00**
- Noite (17:00-23:59) → próximo turno = amanhã **09:00**

### 2. EF (easiness factor)

Novo campo `tarefas.ef numeric(3,2) NOT NULL DEFAULT 2.00 CHECK (ef BETWEEN 1.30 AND 3.00)`.

**Atualização:**
- A cada adiamento (manual OU auto): `ef = min(3.00, ef + 0.10 × (1 − score/100))`
- Ao concluir: `ef = max(1.30, ef − 0.30)` (decay parcial, só da tarefa)
- Pular, voltar, editar: **não mexem no EF**

### 3. Intervalo da N-ésima adiada

```
N = adiamento_count + 1   // 1-indexado, ANTES do incremento
intervalo = base(score_atual) × ef^(N − 1)
```

- `score_atual` = nota recalculada no momento (sempre o atual, RN-16)
- N=1 → `base × 1 = base` (primeira adiada)
- N=2 → `base × ef`
- N=5 → `base × ef^4`

### 4. Travas absolutas (ordem de aplicação)

```
candidato    = agora + intervalo
teto_14d     = agora + 14 dias
limite_prazo = (prazo_conclusao OU data_vencimento) − 1 dia às 09:00
minimo       = próximo turno

adiada_ate = min(candidato, teto_14d, limite_prazo)
adiada_ate = max(adiada_ate, minimo)
```

Se `limite_prazo < próximo_turno` (prazo estourando): força **próximo turno** e
loga alerta — sinal de que a tarefa deveria estar sendo feita agora.

### 5. Hora-do-dia alvo

SM-2 decide **a data**. A **hora** vem da heurística atual (`heuristica.ts`):
- Bucket `tag+dia`/`projeto+dia`/`tag`/`projeto`/`dia` (≥3 amostras)
- Se encontrou padrão: usa a mediana da hora daquele bucket
- Senão: fallback por turno (09/14/19)

Exemplo: SM-2 diz "daqui 2 dias"; heurística diz "mediana 14h" → `adiada_ate = D+2 14:00`.

---

## Aplicação: dois tipos

Aplica pros **dois tipos** (lembrete E tarefa estratégica). O score modula
naturalmente: lembrete importante tem score alto e volta rápido; lembrete
irrelevante tem score baixo e se afasta.

---

## Schema (migração)

```sql
-- supabase/migrations/YYYYMMDD_ef_sm2.sql
ALTER TABLE tarefas
  ADD COLUMN ef numeric(3,2) NOT NULL DEFAULT 2.00
    CHECK (ef BETWEEN 1.30 AND 3.00);

COMMENT ON COLUMN tarefas.ef IS
  'Easiness factor (SM-2 adaptado). Cresce com adiamentos, decresce ao concluir. Modula intervalo da próxima adiada.';
```

**Campos já existentes reusados:**
- `adiamento_count` — N na fórmula
- `adiamento_motivo_auto` — preencher com `"SM-2: score=X, N=Y, EF=Z.ZZ, base=A, ajustado=B"`
- `adiada_ate` — destino final
- `nota` — score (sempre o atual)

---

## KPIs (dashboard em `/gamificacao` — aba nova "Adiamento")

| KPI | Meta | Cálculo |
|-----|------|---------|
| **TRA** · Taxa Re-adiamento pós-auto | <25% | % de `adiada_auto` seguidos por `adiada_*` na próxima aparição |
| **TCA** · Taxa Conclusão pós-auto | >50% | % de `adiada_auto` seguidos por `concluida` na próxima aparição |
| **TEX** · Taxa Expiração | <5% | % de tarefas adiadas que passam do prazo sem voltar |
| **MAC** · Mediana adiamentos/concluída | ≤3 | `mediana(adiamento_count) WHERE status='concluida'` |
| **SAE** · Score-alto-escapando | ~0% | % de tarefas `nota≥90 AND adiamento_count>2` |

- Janela: rolling 30 dias
- Alerta em `/gamificacao` se qualquer KPI ultrapassar meta por 3 dias
- Tabela nova: **não precisa**. KPIs derivados de `historico_acoes` + `tarefas`

---

## Regras de negócio (adicionar em CLAUDE.md)

| ID | Regra |
|----|-------|
| RN-12 | Adiamento automático usa SM-2 adaptado: `base(score) × EF^(n-1)`, ver `docs/11` |
| RN-13 | Mínimo de adiamento = próximo turno (mesmo score 100) |
| RN-14 | Teto de adiamento = 1 dia antes do `prazo_conclusao` às 09:00 |
| RN-15 | Conclusão decai EF em `-0.30` (só da tarefa concluída) |
| RN-16 | Score do adiamento = sempre o atual no momento do cálculo |

---

## Fluxo na prática

```
Usuário pressiona ↓ (adiar auto) ou faz adiamento manual
  ↓
sm2.calcularProximaAdiada(tarefa, agora)
  1. score_atual = recalcularNota(tarefa)
  2. N = adiamento_count + 1
  3. intervalo = base(score_atual) × ef^(N − 1)
  4. hora_alvo = heuristica.decidirHora(tarefa)
  5. data_candidata = agora + intervalo
  6. adiada_ate = aplicar_travas(data_candidata, hora_alvo, prazo)
  7. novo_ef = min(3.00, ef + 0.10 × (1 − score/100))
  ↓
UPDATE tarefas
  SET adiada_ate=..., adiamento_count=adiamento_count+1,
      ef=novo_ef, adiamento_motivo_auto=...
INSERT historico_acoes
  (acao='adiada_auto'|'adiada_manual',
   dados={ateISO, motivo, ef, n, score})
```

---

## Plano de implementação (9 módulos, ~7-10 arquivos)

| M | Arquivo | Descrição |
|---|---------|-----------|
| M1 | `supabase/migrations/YYYYMMDD_ef_sm2.sql` | `ALTER TABLE tarefas ADD COLUMN ef` |
| M2 | `src/lib/adiamento/sm2.ts` | `calcularProximaAdiada()` — core da fórmula |
| M3 | `src/lib/adiamento/heuristica.ts` | refator — passa a retornar só hora-do-dia |
| M4 | `src/app/api/tarefas/[id]/acao/route.ts` | chama sm2; atualiza ef/count |
| M5 | `src/services/kpis-adiamento.ts` | TRA, TCA, TEX, MAC, SAE |
| M6 | `src/app/gamificacao/` (aba nova) | UI dashboard KPIs |
| M7 | `src/lib/adiamento/sm2.test.ts` + outros | testes unit + integration |
| M8 | `CLAUDE.md` | RN-12 a RN-16 |
| M9 | `docs/09_ROADMAP.md` | fase "Adiamento v2" concluída |

**Critérios de verificação** (o que significa "pronto"):
- Typecheck e lint passam
- Unit tests em `sm2.ts` cobrem: base por score, EF growth, teto 14d, trava deadline, score=100 não cresce EF
- Adiar tarefa score 95 no morning → volta 14h do mesmo dia
- Adiar tarefa score 10 cinco vezes consecutivas → intervalo cresce exponencialmente
- KPIs aparecem no dashboard com dados reais
