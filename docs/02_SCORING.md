# 02 — Sistema de Scoring (Nota 0-100)

## Visão geral

Toda tarefa tem uma **nota 0-100** recalculada a cada mudança relevante. A nota determina a ordem da fila de cards. Mais alta = mais cedo na fila.

A nota NÃO é persistida como fonte de verdade — é **derivada** dos insumos (importância, urgência, facilidade, tags, projeto). O valor é materializado para ordenação mas recalculado sempre que os insumos mudam.

## Fórmula

### Fórmula compacta
```
nota_base     = (w_urg × U) + (w_imp × I) + (w_fac × F)
mult_agregado = mult_projeto × ∏ mult_tags_do_tipo_multiplicador
soma_agregada = Σ ajustes_tags_do_tipo_soma_ou_subtracao
percentual    = 1 + (Σ % das tags do tipo percentual / 100)

nota_final = clamp(0, 100, (nota_base × mult_agregado × percentual) + soma_agregada)
```

### Componentes

#### U — Urgência (0-100)
Baseada em `data_vencimento` + `prazo_conclusao` (o prazo é mais estrito).

| Condição | U |
|---|---|
| Atrasada (`data < hoje`) | 100 |
| Vence hoje | 95 |
| Vence amanhã | 85 |
| Vence em 2-3 dias | 70 |
| Vence esta semana (4-7d) | 55 |
| Vence em 2 semanas | 35 |
| Vence em 3-4 semanas | 20 |
| Sem data | 10 |

Se tiver `prazo_conclusao` (deadline hard), somar +5 e multiplicar o efeito de proximidade por 1.2.

#### I — Importância (0-100)
Derivada da **prioridade** do Todoist e do **projeto**:

| Todoist priority | I base |
|---|---|
| P1 ("afeta meu sono") | 90 |
| P2 ("afeta minha rotina") | 65 |
| P3 ("bom ROI") | 40 |
| P4 (padrão) | 20 |

Projetos têm multiplicador próprio (ver abaixo).

#### F — Facilidade (0-100)
Campo manual com preset por tipo:

| Tipo | F default |
|---|---|
| Lembrete (<2min) | 95 |
| Tarefa rápida (5-15min) | 75 |
| Tarefa média (30-60min) | 50 |
| Tarefa grande (2h+) | 25 |
| Tarefa complexa (dias) | 10 |

Usuário pode editar manualmente por tarefa.

### Pesos (w_urg, w_imp, w_fac)

**Defaults** (somam 100):
- `w_urg = 0.40`
- `w_imp = 0.40`
- `w_fac = 0.20`

Configuráveis em `configuracoes.pesos_scoring` (slider 3-way em `/configuracoes`).

### Projeto — multiplicador

Usuário ordena projetos por prioridade em `/projetos`. Ordem → multiplicador:

| Posição | Multiplicador default |
|---|---|
| 1º (mais prioritário) | 1.30 |
| 2º | 1.15 |
| 3º | 1.00 |
| 4º | 0.90 |
| 5º+ | 0.80 |

Usuário pode editar cada multiplicador manualmente.

### Tags — ajustes

Cada tag tem `tipo_peso` (enum):

| Tipo | Efeito | Exemplo |
|---|---|---|
| `multiplicador` | nota × valor | "Urgente" = ×1.25 |
| `soma` | nota + valor | "Quick win" = +8 |
| `subtracao` | nota − valor | "Pode esperar" = −10 |
| `percentual` | nota × (1 + valor/100) | "Cliente VIP" = +15% |
| `peso_custom` | entra na nota_base como 4º eixo | (reservado, futuro) |

Múltiplas tags empilham:
- Multiplicadores multiplicam entre si.
- Somas e subtrações somam.
- Percentuais somam em percentual.

### Tarefa dependente

Se `dependencia_tarefa_id` está setado e a dependência NÃO está concluída:
- Tarefa fica fora da fila principal.
- Nota calculada permanece, mas status lógico é "bloqueada".
- Quando dependência completa, entra na fila naturalmente.

### Tarefa adiada

`adiada_ate > now()` → fora da fila até o horário.
No horário previsto, volta. Nota é recalculada nesse momento (urgência pode ter subido).

### Desempate
Se duas tarefas têm mesma nota:
1. Maior urgência (U).
2. Menor facilidade (prefere rápidas quando importância é igual). ← **revisitar**: usuário pode preferir o oposto.
3. `updated_at` mais recente.

## Exemplos

### Exemplo 1: tarefa "Pagar IPTU vence hoje"
- Vencimento: hoje → U=95
- P1 → I=90
- Facilidade média → F=50
- Projeto "Casa" em 2º lugar → mult=1.15
- Tag "Financeiro" (+5) → soma=5
- nota_base = 0.40×95 + 0.40×90 + 0.20×50 = 38 + 36 + 10 = 84
- nota_final = clamp(0, 100, 84 × 1.15 + 5) = clamp(0, 100, 101.6) = **100**

### Exemplo 2: lembrete "Responder Fulano sobre orçamento"
- Vencimento: amanhã → U=85
- P2 → I=65
- Lembrete → F=95
- Projeto "Trabalho" em 1º → mult=1.30
- Sem tags
- nota_base = 0.40×85 + 0.40×65 + 0.20×95 = 34 + 26 + 19 = 79
- nota_final = clamp(0, 100, 79 × 1.30) = **100** (capped)

### Exemplo 3: tarefa "Estudar livro X"
- Sem data → U=10
- P4 → I=20
- Grande → F=25
- Projeto "Desenvolvimento pessoal" em 4º → mult=0.90
- Tag "Pode esperar" (−10)
- nota_base = 0.40×10 + 0.40×20 + 0.20×25 = 4 + 8 + 5 = 17
- nota_final = clamp(0, 100, 17 × 0.90 − 10) = clamp(0, 100, 5.3) = **5**

## Recalibração

A fórmula acima é o **baseline estático**. A IA pode recalibrar:
- **Pesos globais** (w_urg, w_imp, w_fac) — ajusta o "perfil de decisão" do usuário.
- **Multiplicadores de projeto** — aprende quais projetos geram mais conclusões.
- **Efeito das tags** — aprende padrões.

Detalhes em `docs/07_IA.md` e `docs/08_KPIS.md`.

## Observações de implementação

- `src/lib/scoring/engine.ts` expõe `calcularNota(tarefa, configs) → number`.
- Chamada em:
  - Insert de tarefa nova
  - Update de tarefa existente
  - Update de configs (recalcula batch)
  - Passagem do horário de adiamento
- Cache em memória opcional (LRU) no servidor se a fila for grande.
- Testes em `src/lib/scoring/engine.test.ts` com os 3 exemplos + edge cases.
