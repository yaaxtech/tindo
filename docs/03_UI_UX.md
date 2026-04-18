# 03 — UI/UX, Design System, Swipe, Animações, Som

## Filosofia de design

**Obsidian + Jade.** Escuro, sóbrio, minimalista. Um único ponto de cor (jade) guia o olhar para a ação principal. Nada compete com o card central. Quando o usuário concluir uma tarefa, o app vira uma recompensa sensorial por 1.5s e volta a ser discreto. Isso é neurociência: contraste entre neutralidade → dopamina → neutralidade treina o cérebro a querer a próxima.

## Tokens de design

### Cores

```css
/* backgrounds */
--bg-deep:        #0A0E13;  /* fundo app */
--bg-elevated:    #121820;  /* cards, modals */
--bg-surface:     #1B222C;  /* superfície elevada no card */
--bg-hover:       #222B38;

/* text */
--text-primary:   #E8EDF2;
--text-secondary: #7A8796;
--text-muted:     #4A5563;
--text-inverse:   #0A0E13;

/* jade (brand) */
--jade-primary:   #198B74;  /* ações principais, estado "ok" */
--jade-accent:    #2CAF93;  /* destaques, highlights, pulse */
--jade-glow:      rgba(44, 175, 147, 0.35);
--jade-dim:       #0F5446;

/* feedback */
--success:        var(--jade-primary);
--warning:        #F2B94B;
--danger:         #E3546C;
--info:           #6AA9E6;

/* borders & dividers */
--border-subtle:  rgba(232, 237, 242, 0.08);
--border-strong:  rgba(232, 237, 242, 0.15);

/* gradients */
--grad-jade:      linear-gradient(135deg, #198B74 0%, #2CAF93 100%);
--grad-card:      linear-gradient(180deg, #1B222C 0%, #121820 100%);
```

### Tipografia

- **Família**: Inter (fallback system-ui).
- **Pesos**: 400 (corpo), 500 (labels), 600 (headings), 700 (títulos grandes).
- **Tamanhos** (escala tipográfica):
  - xs=12, sm=14, base=16, lg=18, xl=20, 2xl=24, 3xl=30, 4xl=38, 5xl=48.
- **Leading**: 1.5 para corpo, 1.2 para títulos.

### Espaçamento (4px base)

`1=4px, 2=8px, 3=12px, 4=16px, 6=24px, 8=32px, 12=48px, 16=64px`.

### Raios

- `sm=6px` (inputs), `md=10px` (botões), `lg=16px` (cards), `xl=24px` (modais), `full=9999px` (pills).

### Sombras

```css
--shadow-card:    0 10px 30px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.03) inset;
--shadow-elevated:0 20px 60px rgba(0,0,0,0.5);
--shadow-glow:    0 0 40px rgba(44,175,147,0.35);
```

### Animação

Durations:
- `fast: 120ms`, `base: 220ms`, `slow: 400ms`, `celebrate: 1200ms`.

Easings:
- `standard: cubic-bezier(0.2, 0.8, 0.2, 1)` (padrão tudo)
- `enter: cubic-bezier(0, 0, 0.2, 1)`
- `exit: cubic-bezier(0.4, 0, 1, 1)`
- `spring` via Framer Motion — `stiffness: 300, damping: 30`.

## Layout Shell

### Mobile (<768px)
- Tela cheia para o card.
- Bottom nav de 5 ícones: Cards, Lista, Projetos, Stats, Config.
- Top app bar colapsável (só mostra em scroll up).
- Card ocupa ~85% da viewport.

### Desktop (≥768px)
- Sidebar esquerda fixa (220px): logo, nav.
- Conteúdo principal centralizado (max 720px).
- Card no centro, com atalhos de teclado visíveis nas laterais (`←` `→` `↑` `↓` `Space`).

## O Card

### Estrutura

```
┌─────────────────────────────────────┐
│ [projeto · tag · tag · tag]         │  meta top
│                                     │
│  Título da tarefa grande            │  title (24-30px)
│  Descrição opcional em 2 linhas     │  subtitle
│                                     │
│  ┌───────┐  ┌───────┐  ┌───────┐   │
│  │ Data  │  │ Prazo │  │ Nota  │   │  chips
│  │ 15/04 │  │ Hoje  │  │  87   │   │
│  └───────┘  └───────┘  └───────┘   │
│                                     │
│  Dependente de: "Outra tarefa"      │  (se houver)
│                                     │
│  ┌──────────────────────────────┐  │
│  │     CONCLUIR ✓ (primário)    │  │  botão grande jade
│  └──────────────────────────────┘  │
│                                     │
│  [ 🗑 ]  [ 🔗 ]  [ ✎ ]   [ + ]     │  botões secundários
│                                     │
│  ← anterior   pular →               │  hints
│  ↑ adiar manual   ↓ adiar auto      │
└─────────────────────────────────────┘
```

### Swipe — convenção (decidida 2026-04-17)

| Direção | Ação | Undo? |
|---|---|---|
| ← ESQUERDA | **Pular** (próxima tarefa da fila) | Sim, swipe → reverte |
| → DIREITA | **Voltar** (tarefa anterior mostrada) | Sim, swipe ← reverte |
| ↑ CIMA | **Adiar manual** (abre 2º nível de swipe) | Esc |
| ↓ BAIXO | **Adiar automático** (heurística decide) | Undo na toast por 5s |

**Modelo mental**: a tarefa atual é uma carta no topo da pilha.
- Empurrar a carta **para a esquerda** = "joga a carta pra trás da pilha" = pula pra próxima.
- Empurrar a carta **para a direita** = "puxa a carta anterior pra frente" = volta.

Keyboard segue a mesma convenção: **← pular**, **→ voltar**.

### Adiamento manual (nível 2)

Ao fazer ↑, o card se contrai e aparece novo set de opções no centro:

```
┌──────────────────────────────────┐
│                                  │
│       Quando adiar?              │
│                                  │
│    ← Amanhã mesmo horário        │
│                                  │
│  ↑ Escolher                       │
│                                  │
│    → Próximo turno (hoje)         │
│                                  │
│  ↓ Cancelar (voltar ao card)      │
│                                  │
└──────────────────────────────────┘
```

- **→ Próximo turno**: manhã→tarde (12h), tarde→noite (18h), noite→amanhã manhã (8h).
- **← Amanhã mesmo horário**: now() + 24h.
- **↑ Escolher**: abre date-time picker (DialogSheet).
- **↓ Cancelar**: volta pro card.

### Keyboard (desktop)

| Tecla | Ação |
|---|---|
| `←` | Pular (próxima) |
| `→` | Voltar (anterior) |
| `↑` | Adiar manual (abre nível 2) |
| `↓` | Adiar automático |
| `Space` ou `Enter` | Concluir |
| `E` | Editar |
| `D` | Excluir (com confirmação) |
| `L` | Marcar dependência |
| `N` | Nova tarefa |
| `Esc` | Fechar modal/voltar do nível 2 |
| `Cmd/Ctrl+Z` | Undo última ação |

### Gestos do swipe (Framer Motion)

- Limiar de "soltar": ≥30% da largura do card OU velocidade ≥500 px/s.
- Feedback durante drag:
  - 0-30%: card acompanha o dedo/mouse, opacidade 100%.
  - 30-100%: cor de borda muda indicando ação:
    - Direita → borda jade clara + label "Pular →"
    - Esquerda → borda cinza + label "← Voltar"
    - Cima → borda azul + label "↑ Adiar manual"
    - Baixo → borda amarela + label "Adiar auto ↓"
- Ao soltar fora do limiar: spring back ao centro.
- Ao passar o limiar: fly off + novo card entra (animação 320ms).

## Animação de Conclusão (VICIANTE)

**Objetivo**: toda vez que o usuário concluir uma tarefa, ele deve querer concluir a próxima **só pela recompensa sensorial**.

### Sequência (timing total: 1200ms)

0. **0ms** — click no botão "Concluir ✓":
   - Botão sofre pequena compressão (scale 0.96, 80ms).
1. **80ms** — explosão:
   - Som: chord jade (C-E-G, síntese Tone.js, ~600ms, decay exponencial).
   - Card faz scale 1.02 + borda vira jade accent + glow forte.
   - Partículas (confetti jade/accent) saem do centro, 30 partículas.
2. **200ms** — check fantasma:
   - ✓ gigante aparece no centro do card (opacity 0→1, scale 0→1.2→1), em jade accent com glow.
3. **500ms** — card encolhe e "flutua pra cima":
   - translateY(-120px), opacity 1→0, scale 1→0.8, 400ms.
4. **900ms** — ticker "+XP" flutua do lugar do card:
   - "+15 XP" em jade, sobe 40px + fade out, 300ms.
5. **1200ms** — próximo card entra:
   - de baixo, translateY(80px→0), opacity 0→1, 260ms com spring.

### Variações sonoras

- **Tarefa normal**: C major chord.
- **Streak +1**: adicionar nota alta (E5) como "cereja".
- **Nível up**: arpejo ascendente C-E-G-C5.
- **100ª tarefa concluída**: fanfare curta.

Implementação em `src/lib/audio/tones.ts`. Respeita `prefers-reduced-motion` e setting `audio_habilitado`.

### Acessibilidade (NUNCA esquecer)

- `prefers-reduced-motion`: corta animações (scale/translate) e mantém só fade 200ms.
- Screen reader: `aria-live="polite"` anuncia "Tarefa concluída, +15 XP".
- Som: toggle em configurações `audio_habilitado` (default `true`, mas com switch visível na 1ª conclusão).
- Contraste: todos textos ≥ WCAG AA.

## Empty states

- Fila vazia: "Tudo feito por agora 🌿" + ilustração minimal + CTA "Sincronizar com Todoist" / "Adicionar tarefa".
- Sem conta: tela de login clean (Magic Link).
- Erro de sync: toast não-intrusivo com "Tentar de novo".

## Telas principais

### /cards
- Viewport cheia do card.
- Contador discreto no topo: "12 tarefas · 3 lembretes pendentes".
- Streak badge no canto superior direito.

### /tarefas
- Lista agrupada por dia (hoje, amanhã, esta semana, depois).
- Filtros: projeto, tag, status, tipo.
- Busca por título.
- Cada linha: título, projeto, chips, nota, ações rápidas.

### /projetos
- Lista drag-and-drop (react-dnd-kit).
- Badge de multiplicador ao lado de cada.
- Edit inline (clicar = abrir modal).
- "Adicionar projeto" no fim.

### /tags
- Lista com tipo de peso e valor.
- Ao criar, wizard: "Como essa tag afeta a nota?" → escolher tipo → valor.

### /gamificacao
- Streak grande no topo (número + "dias").
- XP bar + nível atual.
- Heatmap (estilo GitHub) dos últimos 90 dias.
- Lista de conquistas (desbloqueadas + travadas com meta).

### /calibracao
- Wizard inicial (primeira vez): perguntas sobre critérios de sucesso.
- Recalibração: slide com 5 tarefas + slider 0-100.

### /configuracoes
- Abas: Perfil, Scoring, Todoist, IA, Notificações, Dados, Privacidade.
- Scoring: sliders de w_urg/w_imp/w_fac (soma trava em 100).
- Todoist: input do token + botão testar + status sync.

## Microcopy

- Tom: direto, amigável, sem jargão.
- Português BR.
- Lembrar o propósito: "Prioridade aqui é o que MAIS te desprecupa, não o que é mais urgente."
- Feedback sempre positivo ou neutro. Nunca culpar o usuário.
