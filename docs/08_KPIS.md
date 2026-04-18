# 08 — KPIs e Recalibração

## Propósito

KPIs servem **duas audiências**:
1. **Usuário** — saber se está evoluindo; ter autojulgamento de valor.
2. **Sistema** — detectar quando recalibrar pesos, projetos, tags, IA.

## Lista de KPIs

### KPIs do usuário (vistos em `/gamificacao`)

| KPI | Fórmula | Meta default |
|---|---|---|
| KPI-U01 Conclusões hoje | COUNT(tarefas.concluida_em = hoje) | — |
| KPI-U02 Conclusões esta semana | idem semana | 25 |
| KPI-U03 Streak atual | `gamificacao.streak_atual` | manter |
| KPI-U04 Streak recorde | `gamificacao.streak_recorde` | — |
| KPI-U05 Tempo médio decisão | mean(tempo_ms) em `historico_acoes` WHERE acao='mostrada' últimos 7 dias | ≤ 5s |
| KPI-U06 Taxa conclusão | concluidas / mostradas últimos 7 dias | ≥ 40% |
| KPI-U07 Nota média das concluídas | avg(nota) WHERE acao='concluida' | ≥ 60 |
| KPI-U08 Lembretes pendentes | COUNT tipo='lembrete' e status='pendente' | ≤ 10 |
| KPI-U09 XP diário | XP ganho hoje | variável |
| KPI-U10 % das concluídas que eram alta prioridade | % nota ≥ 80 | ≥ 30% |

### KPIs do sistema (disparadores de recalibração)

| KPI | Fórmula | Limiar default | Ação ao passar |
|---|---|---|---|
| KPI-S01 % reavaliação humana | tarefas com nota alterada manualmente / total com IA aplicada (últimos 30d) | > 30% | Recalibração de pesos |
| KPI-S02 % descarte sugestões novas tarefas | sugestões rejeitadas / total (últimos 30d) | > 50% | Recalibração de caminho crítico |
| KPI-S03 % adiamento | adiadas / mostradas (últimos 14d) | > 40% | Tela slide das 5 adiadas |
| KPI-S04 % lembretes ignorados | lembretes sem ação há > 48h / total lembretes ativos | > 50% | Sugestão: "ajustar regras de lembretes?" |
| KPI-S05 Divergência nota-slider | \| nota - slider \| médio na tela das 5 | > 20 | Sugestão: recalibração full |
| KPI-S06 Razão conclusão/criação | concluidas / criadas (últimos 30d) | < 0.7 | Alerta: lista crescendo — focar ou podar |
| KPI-S07 Tempo de decisão subindo | delta semanal do mean(tempo_ms) | > +20% semana-a-semana | Sugestão: "tarefas estão confusas?" — revisar títulos |
| KPI-S08 Latência sync Todoist | p95 de latência sync | > 10s | Alerta interno (log) |
| KPI-S09 Erro sync Todoist | % falhas / total | > 5% | Alerta + desabilitar temporariamente |

Limiares são **configuráveis** em `configuracoes`. Usuário pode desativar ou afrouxar.

## Mecanismo de recalibração

### 1. Recalibração de pesos (W_urg, W_imp, W_fac)

**Disparo**: KPI-S01 > limiar OU botão manual.

**Fluxo**:
1. Sistema seleciona 5 tarefas representativas (últimas editadas manualmente após classificação da IA).
2. Mostra tela: slider 0-100 "Quanto te preocupa?" para cada.
3. Calcula correlação entre slider-usuário e nota-sistema:
   - Correlação forte com urgência → ajusta w_urg pra cima.
   - Correlação forte com importância → ajusta w_imp pra cima.
   - Correlação com facilidade → ajusta w_fac.
4. Propõe novos pesos (normalizados pra somar 1.0).
5. Usuário aceita/ajusta/rejeita.
6. Se aceito: salva em `configuracoes` + recalcula notas de todas as tarefas.

### 2. Recalibração de caminho crítico

**Disparo**: KPI-S02 > limiar OU usuário notifica "mudou meu foco".

**Fluxo**:
1. Tela: "Seus critérios de sucesso atuais são X, Y, Z. Ainda fazem sentido?"
2. Usuário pode editar / substituir / confirmar.
3. IA é recalibrada (system prompt novo) e pode refazer sugestões.

### 3. Recalibração de adiamento (slide das 5)

**Disparo**: KPI-S03 > limiar OU botão manual.

**Fluxo**:
1. Tela com 5 tarefas adiadas recentemente.
2. Slider 0-100 de preocupação para cada.
3. Se alta discordância entre slider e nota: sugere recalibração de pesos também.
4. Se baixa: atualiza notas dessas tarefas + aprende padrão de adiamento (tarefas ABC são adiadas mesmo quando têm nota alta — talvez precisem ser quebradas?).

## Dashboard de KPIs

Em `/gamificacao`:
- Cards visuais dos U01-U07.
- Heatmap de 90 dias.
- Gráfico semanal de conclusões (sparkline).

Em `/configuracoes/insights`:
- KPIs S01-S07 com semáforo.
- Histórico de recalibrações feitas (com diff de pesos).

## Implementação

### Coleta
- Toda ação do usuário → insert em `historico_acoes`.
- Cron diário (1x) agrega e calcula KPIs em view materializada `kpis_usuario_diario`.

### Avaliação
- `src/services/kpis.ts` → `avaliarRecalibracao()`:
  - Roda todos os KPIs S.
  - Retorna lista de gatilhos disparados.
- Cron diário (ou on login) verifica e cria notificação in-app se algum passou.

### View materializada (exemplo)

```sql
CREATE MATERIALIZED VIEW public.kpis_usuario_diario AS
SELECT
  usuario_id,
  date_trunc('day', created_at)::date AS dia,
  COUNT(*) FILTER (WHERE acao='concluida') AS concluidas,
  COUNT(*) FILTER (WHERE acao='mostrada') AS mostradas,
  COUNT(*) FILTER (WHERE acao IN ('adiada_auto','adiada_manual')) AS adiadas,
  AVG(tempo_ms) FILTER (WHERE acao='mostrada') AS tempo_medio_ms
FROM public.historico_acoes
GROUP BY usuario_id, date_trunc('day', created_at);

CREATE UNIQUE INDEX ON public.kpis_usuario_diario (usuario_id, dia);
```

Refresh diário via cron.

## Princípio de ouro

> **"O humano é o juiz de valor do que a máquina faz."** Todo KPI do sistema serve para facilitar esse julgamento. Nenhum KPI substitui o juízo humano; ele só aponta "ei, vale a pena você olhar isso".
