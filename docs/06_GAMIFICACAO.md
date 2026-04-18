# 06 — Gamificação e Neurociência

## Princípio

**Ciclo dopamina saudável**: cada conclusão → micro-recompensa imediata (som + visual) + ticker XP + progressão visível (streak, nível). O cérebro associa "concluir tarefa no TinDo = prazer", transformando produtividade em loop positivo — **sem manipulação tóxica** (nada de badges infinitos, notificações abusivas, FOMO artificial).

## Componentes

### 1. XP e Nível

**Ganho de XP**:
- Concluir tarefa: base 10 XP × multiplicador da nota (nota 80 → +8 = 18 XP).
- Concluir lembrete: 5 XP.
- Streak diário ativo: +5 XP no primeiro concluir do dia.
- Primeira conclusão do dia: +10 XP de "bom dia".
- Quebrar recorde de streak: +50 XP.
- Desbloquear conquista: XP variável por conquista.

**Nível**:
- Curva: XP para nível `n` = `50 × n^1.5` (nível 2 = 71 XP, nível 10 = 1581 XP, nível 20 = 4472 XP).
- Ao subir de nível: fanfare + animação no avatar + notificação persistente.

### 2. Streak

**Regra**: dia ativo = ≥1 tarefa concluída (lembrete não conta pra streak, pra evitar inflar).
- `streak_atual` incrementa a cada dia ativo consecutivo.
- Reset em 0 se passar 1 dia sem atividade (tolerância de 1 "congelamento" por semana, ver Freeze Token).
- `streak_recorde` é o máximo histórico.

**Exibição**:
- Badge sempre visível no header com "🔥 12" (número do streak atual).
- Cor do ícone: cinza (0), laranja (1-6), jade (7-29), pulsante accent (30+).

**Freeze token (anti-streak-anxiety)**:
- Usuário ganha 1 "congelador" a cada 7 dias de streak.
- Se perder um dia, o sistema auto-usa um congelador (se tiver).
- Notifica amigável: "Usei 1 congelador pra proteger seu streak 🧊".

### 3. Heatmap (estilo GitHub)

- 90 dias na tela de `/gamificacao`.
- Cada célula: cor baseada em tarefas concluídas naquele dia (0, 1-2, 3-5, 6-9, 10+).
- Tooltip: "15/04 — 4 tarefas, 2 lembretes".

### 4. Conquistas (catálogo inicial)

| Código | Nome | Meta | XP |
|---|---|---|---|
| `primeira_tarefa` | Primeira gota | Concluir 1 tarefa | 20 |
| `primeiro_lembrete` | Eu lembro | Concluir 1 lembrete | 10 |
| `streak_3` | Trilogia | Streak de 3 dias | 30 |
| `streak_7` | Uma semana firme | Streak de 7 dias | 75 |
| `streak_30` | Mês consistente | Streak de 30 dias | 300 |
| `streak_100` | Centurião | Streak de 100 dias | 1000 |
| `concluir_10` | Uma mão | 10 tarefas concluídas | 40 |
| `concluir_50` | Metade do caminho | 50 tarefas | 150 |
| `concluir_100` | Triplo dígito | 100 tarefas | 400 |
| `concluir_500` | Meio milhar | 500 tarefas | 1500 |
| `concluir_1000` | Quatro dígitos | 1000 tarefas | 5000 |
| `manha_cedo` | Madrugador | Concluir antes das 8h (3 vezes) | 60 |
| `noite_cerrada` | Coruja | Concluir após 22h (3 vezes) | 60 |
| `nota_alta` | Focado no que importa | 10 tarefas com nota ≥80 | 100 |
| `sem_adiar` | Direto ao ponto | 20 conclusões sem adiamento | 100 |
| `calibracao` | Autoconhecimento | Completar 1ª recalibração | 80 |
| `primeiro_sync` | Conectado | Sincronizar com Todoist | 30 |
| `sem_lembrete_pendente` | Zerou a caixa | Zerar lembretes por 3 dias | 120 |
| `comeback` | De volta | Voltar após 7+ dias inativo | 40 |
| `juizo` | Juiz | Completar 5 recalibrações | 200 |

Mais conquistas adicionadas conforme uso.

### 5. Feedback imediato (neurociência)

**Na conclusão** (ver `docs/03_UI_UX.md` para detalhes):
- Som tonal (Tone.js) — chord C major em 600ms, decay exponencial.
- Partículas confetti jade (30 partículas, physics via Framer Motion).
- Check gigante no card (scale 0→1.2→1 + glow).
- "+15 XP" flutua e some.
- Próximo card desliza de baixo com spring.

**Tempo total**: 1200ms. Não é interrompível. Depois disso, zero delay.

**Variação sonora** evita acomodação:
- Nota "fundamental" varia entre 5 tons (C, D, E, F, G) aleatoriamente.
- Previne que o cérebro "preveja" o som e perca a novidade.

### 6. Progressão de longo prazo

**Anéis semanais** (inspirado Apple Watch):
- Cada semana tem 3 anéis:
  - 🟢 **Conclusão**: meta semanal (default 25 tarefas).
  - 🔵 **Foco**: tempo médio de decisão ≤ 5s (proxy de clareza).
  - 🟡 **Diversidade**: concluir em ≥3 projetos diferentes.
- Fechar os 3 = "semana perfeita" + 200 XP.

**Reports semanais** (domingo 20h, push notification opcional):
- "Você concluiu 32 tarefas esta semana (vs 28 na passada +14%). Top projeto: Trabalho. Tempo médio de decisão: 4.2s."

### 7. Friendly classifier (o "slide das 5 tarefas")

Aparece periodicamente (gatilhos: KPI adiamento alto ou a cada 50 tarefas concluídas):
1. Tela com 5 cards pequenos (tarefas recentes ou adiadas).
2. Slider 0-100: "Quanto cada uma te preocupa?"
3. Usuário arrasta os cards na escala.
4. Sistema compara com a nota calculada.
5. Se divergência grande (>20 pontos): sugere recalibração.

Experiência: gamificada, simples, leva 60s.

## Regras anti-tóxicas

- ❌ Nenhum badge "dormido" piscando indefinidamente.
- ❌ Nenhuma notificação tipo "você não fez nada hoje".
- ❌ Nenhum ranking social obrigatório.
- ❌ Nenhum contador regressivo cruel (streak = congelador protege).
- ✅ Toda conquista é celebrativa e única (fanfare só 1x).
- ✅ XP nunca diminui.
- ✅ Streak perdoa 1 dia/semana via congelador.
- ✅ Usuário pode desligar tudo em Configurações → Bem-estar.

## Implementação técnica

### Tabelas
- `gamificacao` (1:1 usuário) — ver `docs/04_SCHEMA.md`.
- `conquistas` (catálogo) + `conquistas_usuario` (desbloqueios).

### Serviço
- `src/services/gamificacao.ts`:
  - `registrarConclusao(tarefa)` — XP, streak, conquistas, triggers.
  - `calcularNivel(xp)` — puro, sem side effects.
  - `checkConquistas(usuario_id)` — avalia catálogo contra estado atual.

### Store
- `useGamificacaoStore` (Zustand) — XP, nível, streak pro UI reativo.
- Hidrata de Supabase no login, atualiza otimista em conclusões.

### Som
- `src/lib/audio/tones.ts`:
  - `playCompletion(variante?)` — função principal.
  - `playLevelUp()` — arpejo.
  - `playConquista()` — fanfare.
- Tone.js inicializado na 1ª interação do usuário (política do browser).

### Animações
- Framer Motion para tudo.
- `reduce motion` detectado e respeitado.
