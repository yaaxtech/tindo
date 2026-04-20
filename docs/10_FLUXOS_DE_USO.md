# 10 · Fluxos de Uso e Objetivos

Direcionamento de produto sobre **como o usuário trabalha** — define os 3 modos
de uso que a fila/UI do TinDo deve abranger. Fonte: conversa de 2026-04-20.

---

## Taxonomia das tarefas (visão do usuário)

O usuário organiza o Todoist em 3 tipos distintos:

| Tipo | Característica | Origem | Tratamento esperado |
|------|---------------|--------|-------------------|
| **Sem Classificação** | Jogada no inbox na correria. Sem prioridade/data definidas. Pode virar lembrete ou tarefa depois. | `##Entrada` (Inbox Todoist) | **Triagem** rápida: vira Lembrete ou Tarefa |
| **Lembrete** | <2min, operacional, normalmente com data/hora. | Labels (`lembretes`, `fazer 2min`, `criar /`) ou projetos com `"lembrete"`/`"ativ. rapidas"` | **Matar rápido**: concluir ou adiar, nunca pular |
| **Tarefa** | Estratégica. Pode ter prazo, raramente tem data fixa. Classificação de prioridade obrigatória. | Label `todo` ou projeto com `" todo"` no nome | Listar **por prioridade (nota 0-100)**, não adia; reordena |

---

## Tags colaborativas do padrão `EM.*`

Padrão pessoal do usuário no Todoist. Status atual no TinDo:

| Tag | Significado | Status no código |
|-----|-------------|------------------|
| `@EM.Coop` | Responsabilidade dividida com companheiro. Concluir deve refletir no Todoist do parceiro. | **Não mapeado** — precisa write-back propagado |
| `@EM.Acomp` | Tarefa não é do usuário, mas ele quer acompanhar. | **Não mapeado** — ideal: gerar **lembrete próprio** no TinDo pra conferir andamento |
| `@EM.naoAparecer` | Excluir da fila principal. | **Mapeado** (`em.naoaparecer` em `src/lib/todoist/mapper.ts`) |
| `@naoAparecerLembretes` | Excluir especificamente de lembretes. | **Mapeado** (`naoaparecerlembretes` em `src/lib/todoist/mapper.ts`) |
| `@EM.inativo` | Desativada. | **Mapeado** (`em.inativo`) |

---

## Três modos de uso da fila

A fila principal deve abranger 3 modos, encadeados como sequência natural de uso
(matutina/zerar caixa → organizar → trabalhar no estratégico):

### 1. Modo Lembretes (matar rápido)
Pilha só de lembretes — operacional. Duas ações essenciais: **concluir** ou **adiar**
(não se pula — RN-01). Zero classificação. Alto throughput, UI minimalista.

### 2. Modo Triagem (classificar o inbox)
Pilha só de itens de `##Entrada` sem classificação (sem prioridade/sem data ou P4).
Cada card expõe decisão rápida: virou Lembrete? virou Tarefa? prioridade? projeto?
data/prazo? Objetivo: zerar o inbox sem friccionar.

### 3. Modo Tarefas (estratégicas, priorizadas)
Pilha de tarefas ordenadas por nota 0-100. **Não se adia** — só se **reordena**.
Suporta **dependências explícitas** ("preciso terminar A antes de B") entre tarefas
irmãs do mesmo projeto/objetivo.

---

## Filtro referência (Todoist do usuário)

Filtro atual no Todoist — espelho do que deve alimentar os modos 1 e 2:

```
((##Entrada & ((assigned to: me | !assigned | @EM.Coop) & !@EM.naoAparecer & !@naoAparecerLembretes & ((no date & (p1 | p4)) | overdue | due before: +0 hours | (today & no time))))
 | ((assigned to: me | !assigned | @EM.Coop) & ((no date & p1) | overdue | due before: +0 hours | (today & no time)) & !@EM.naoAparecer & !@naoAparecerLembretes)
 | ((assigned to: me | !assigned | @EM.Coop | @EM.Acomp) & (deadline: today | deadline before: today) & !@naoAparecerLembretes))
& !subtask
```

Decomposto:
- **Inbox sem classificação**: `##Entrada` + sem data + (P1 ou P4) — ou overdue, due ou hoje.
- **P1 global**: qualquer projeto, sem data + P1 — ou overdue, due ou hoje.
- **Deadline hoje/passado**: inclui `@EM.Acomp` (acompanhamento).
- **Exclusões**: subtarefas, `@EM.naoAparecer`, `@naoAparecerLembretes`.
- **Inclusões de assignee**: atribuída a ele, sem atribuição, ou `@EM.Coop` (e `@EM.Acomp` na terceira ramificação).

---

## Gaps para implementar

1. Código **não reconhece** `##Entrada` (Inbox do Todoist) como fonte especial — precisa coluna/flag `origem_inbox` ou derivação pelo `project_id` do Inbox.
2. Labels `EM.Coop` e `EM.Acomp` **não tratadas**:
   - `EM.Coop`: precisa write-back propagando conclusão pro parceiro.
   - `EM.Acomp`: precisa gerar **lembrete-espelho** próprio no TinDo.
3. **Não existe seletor de modo** na UI (Lembretes / Triagem / Tarefas) — hoje a fila é única.
4. **Dependências irmãs** (forçar ordem entre tarefas de mesmo projeto/objetivo) — a coluna `dependencia_tarefa_id` existe só para subtarefas.
5. Tipagem `tarefa` não distingue "sem classificação" de "tarefa estratégica" — hoje é binária (`lembrete`/`tarefa`/null).

---

## Princípios que orientam esses modos

- **Throughput importa**: matar lembretes tem que ser ritmo de metralhadora.
- **Classificar não é punição**: triagem precisa ser mais rápida que abrir o Todoist.
- **Estratégico não interrompe**: tarefas só aparecem depois que lembretes e triagem estão zerados (ou por escolha explícita de modo).
- **Convenção híbrida mantida**: mobile Tinder + desktop browser (ver `CLAUDE.md`).
