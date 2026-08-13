# Bloco "Minutos do GitHub" no /harness — decisão + gestão

**Data:** 2026-08-13 · **Pedido do dono:** "KPIs pra decidir sobre pagar ou não
GitHub minutes, e dados de como melhor gerenciá-los".

## O problema, em uma frase

Hoje ninguém sabe se vale pagar minutos do GitHub Actions, porque os dois
números que decidem — quanto custaria e quanto de espera isso compraria —
nunca foram medidos.

## Os 3 fatos que o desenho respeita

**1. Minuto faturado é tempo de JOB, não de run.** Em 12/08, medir
`updated_at − created_at` da run deu 8.334 min contra 2.001 reais: fila e
cancelamento entravam na conta. Job só se obtém em `/runs/{id}/jobs`, uma
requisição por run. `/timing` devolve 0 nesta conta — não usar.

**2. O repo que queima a cota é PRIVADO.** `seucamarao/seucamaraov1` consome
~700–1.000 min/dia quando está na nuvem; `yaaxtech/tindo` é ruído perto disso.
Sem token, o coletor do app não enxerga nada dele.

**3. Hoje tudo roda no Mac, então o faturado é ~zero.** Um painel que mostrasse
só o faturado marcaria 0 e não decidiria nada. O número que decide é o
**equivalente**: quantos minutos o trabalho custaria SE estivesse na nuvem.

## Desenho

### Onde a coleta roda: na máquina do dono, não no app

O coletor é `~/.claude/orquestracao/coletar-actions.mjs`, disparado pelo mesmo
launchd de hora em hora que já roda `publicar-painel.mjs`. Motivo: ali o `gh`
já está autenticado, inclusive no repo privado. Nenhum segredo novo no
Cloudflare, nenhum rate limit gasto pelo app, e a coleta fica mais fresca
(1×/hora) do que o cron diário conseguiria.

Ele empurra um blob **agregado por dia** para a tabela singleton
`harness_actions_snapshot` (migration `20260813000003`, já escrita). Agregado, e
não job a job, por dois motivos: o PostgREST trunca em 1000 linhas e 90 dias
passam de 9.000 jobs; e o valor é comparar mês com mês, não fazer forense.
O agregado diário é também o histórico que o GitHub descarta em ~90 dias — é o
único lugar onde ele sobrevive.

### Custo da coleta, e como fica barato

A primeira passada precisa de 1 requisição por run (~4.500 em 90 dias). O
coletor mantém `~/.claude/orquestracao/actions-coletados.json` com os `run_id`
já processados e busca no máximo **400 runs por execução**, das mais recentes
para as mais antigas. Rodando de hora em hora, semeia os 90 dias em ~12h e
depois custa quase nada. Run ainda não concluída nunca entra no arquivo de
estado — precisa ser rebuscada.

### Contrato do blob

```ts
interface ActionsDia {
  dia: string;              // 'YYYY-MM-DD' em UTC
  repo: string;
  min_faturado: number;     // jobs em runner da NUVEM (custa dinheiro)
  min_mac: number;          // jobs em runner self-hosted (grátis)
  runs: number;
  jobs: number;
  jobs_falha: number;
  jobs_cancelado: number;
  min_perdido: number;      // minutos de jobs failure/cancelled (nuvem + mac)
  fila_seg: number[];       // amostras de (job.started_at − job.created_at)
}

interface ActionsBranch {
  branch: string;
  runs: number;
  min_total: number;        // nuvem + mac: mede consumo de slot também
  virou_pr: boolean;
  mergeado: boolean;
}

interface ActionsStep { nome: string; seg_total: number; n: number }

interface ActionsBlob {
  gerado_em: string;
  ciclo_inicio: string;     // 1º do mês corrente, UTC
  cota_min: number;         // 2000
  custo_min_usd: number;    // 0.008
  repos: string[];
  dias: ActionsDia[];       // últimos 90 dias
  branches: ActionsBranch[];// top 20 do ciclo por min_total
  steps: ActionsStep[];     // top 15 do ciclo por seg_total
  fila_por_hora: { hora: number; p50: number | null; p90: number | null; n: number }[];
  prs_mergeados_ciclo: number;
  destino: { RUNNER_CI: string | null; RUNNER_LEVE: string | null };
  parcial: string | null;   // motivo de a coleta ter vindo incompleta
}
```

Regra de classificação nuvem × Mac: job cujo `runner_name` contém `mac-` é
self-hosted (grátis). `conclusion === 'skipped'` não fatura e não entra em
nenhuma soma. Cada job soma `ceil((completed_at − started_at)/60)`, mínimo 1 —
é assim que o GitHub arredonda.

### Os 9 KPIs (lib pura `src/lib/harness/actions.ts`)

**Decidir se paga**
1. `minutosCiclo` — faturado no ciclo · `pctCota` · `projecaoMes` (regra de três
   pelos dias decorridos) · `custoEstouroUsd` = `max(0, projeção − 2000) × 0,008`.
2. `equivalenteNuvem` — `min_faturado + min_mac` projetado no mês. **É o número
   que decide**: diz quanto custaria ligar a nuvem hoje.
3. `filaP50` / `filaP90` — espera antes do job começar. O preço da opção grátis.
4. `usdPorHoraEconomizada` — `custoEstouroUsd ÷ horas de fila que a nuvem
   eliminaria`. Null quando a fila é zero (não há o que comprar).
5. `minPorPrMergeado` — separa "produzimos mais" de "desperdiçamos mais".

**Gerenciar melhor**
6. `concentracaoBranch` — top 5 por `min_total` e o % da maior. Em 13/08 uma
   branch sozinha fez 20 de 100 runs de CI.
7. `desperdicioPct` — `min_perdido ÷ total`, mais os minutos de branch que
   nunca virou PR.
8. `stepDominante` — nome e % do total. Medido em 13/08: Vitest = 74%
   (2.365s de 3.191s).
9. `horaPico` — hora do dia com a pior fila. Fila concentrada em pico se
   resolve com mais um slot de runner, de graça — não com assinatura.

**Veredito** (uma frase, em português leigo, derivado, nunca escrito à mão):
- `projecaoEquivalente ≤ cota` → a nuvem sairia **de graça** e mataria a fila
  → recomendar ligar.
- `projecaoEquivalente > cota` e `filaP50 < 2 min` → o Mac já responde na hora;
  pagar compra quase nada → recomendar ficar.
- `projecaoEquivalente > cota` e fila alta → mostrar `usdPorHoraEconomizada` e
  deixar a conta explícita.

Todo percentual mostra a amostra `x/y` (padrão já vigente no painel). Sem
amostra suficiente, o KPI mostra "—", nunca um número inventado.

### Tela

Componente `src/app/harness/_components/MinutosGithub.tsx`, seção
`minutos-github` ("Minutos") no grupo **Dinheiro** de `secoes.ts`, logo antes de
Assinaturas. Segue o padrão visual de `TemposGithub.tsx` e os primitivos de
`ui.tsx`. O veredito vai no topo do bloco, em destaque. Tabela vazia (coleta
ainda não rodou) → estado vazio explicativo, nunca erro.

## Fronteiras

- **NÃO** mexer em `coletor-github.ts`, `github-timings.ts`, `revisor.ts`,
  `alertas.ts`, `kpis.ts` nem em nenhum bloco existente do painel.
- **NÃO** alterar a migration `20260813000003` (já escrita e revisada).
- **NÃO** aplicar migration em produção — isso exige OK do dono.
- **NÃO** adicionar segredo, variável de ambiente ou dependência nova.
