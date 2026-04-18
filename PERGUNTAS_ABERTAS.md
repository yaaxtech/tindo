# PERGUNTAS ABERTAS — decisões do humano

> ⚠️ **NUNCA cole credenciais (API keys, tokens, senhas) neste arquivo** — ele é tracked no git. Use `.env.local` (gitignored). Se precisar compartilhar, cole direto no chat.

---

## ✅ RESPONDIDAS em 2026-04-17

### Q1. Credenciais Supabase — ✅
Recebidas via chat e salvas em `.env.local`.
- Projeto: `jtpfauouvbtmhgrszybk`
- `SUPABASE_ANON_KEY`: ✅ em `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY`: ✅ em `.env.local`
- `SUPABASE_DB_PASSWORD`: ✅ em `.env.local`

### Q2. Todoist API token — ✅
Recebido via chat e salvo em `.env.local` como `TODOIST_API_TOKEN`.

### Q3. Anthropic API key — ✅
Recebida via chat e salva em `.env.local` como `ANTHROPIC_API_KEY`.

### Q4. Cloudflare Pages setup
- Conta Cloudflare: **criada** ✅
- Setup de deploy guiado: **amanhã** ⏳
- Domínio final: **amanhã** ⏳

### Q5. Repositório GitHub
- `yaaxtech/tindo` está vazio e pronto: ✅
- Público: ✅
- `gh` CLI autenticado local: ❌ → vou push via HTTPS + PAT ou orientar no amanhã.

### Q6. Convenção do swipe — ✅ INVERTIDA da minha proposta
Decisão: seguir a intuição original do usuário ("empurrar a carta pra trás/esquerda = próxima").
- **← ESQUERDA**: PULAR (próxima tarefa)
- **→ DIREITA**: VOLTAR (tarefa anterior)
- **↑ CIMA**: adiar manual
- **↓ BAIXO**: adiar automático

Keyboard segue a mesma convenção: seta esquerda = pular, direita = voltar.

### Q7. Autenticação — ✅ Magic Link por email

### Q8. Adiamento reflete no Todoist — ✅ Sim

### Q9. Fila principal — ✅ Todas pendentes ordenadas por nota

### Q10. Volume Todoist
- ~20 lembretes, ~450 tarefas = ~470 itens. Bem gerenciável, sem pressão de paginação imediata.

### Q11. Monetização — ✅ Solo agora, público depois
Schema já é multi-tenant ready (`usuario_id` em tudo).

### Q12. Dispositivos — ✅ iPhone inicial, PWA first
PWA instalável no iOS resolve o MVP. Nativo (Capacitor/RN) fica pra depois.

### Q13. Sons — ✅ Neurocientificamente comprovados
Tone.js sintetiza:
- Intervalos de terça maior (prazer) — C-E-G.
- Resolução harmônica (satisfação de fechamento).
- Variações pra evitar acomodação neural.
- Decay exponencial ≤ 600ms (dopamina sem saciedade).
Ver `docs/03_UI_UX.md` e `src/lib/audio/tones.ts`.

### Q14. Push notifications — ❌ Por enquanto não

### Q15. Idioma — ✅ PT-BR por tempo indefinido

### Q16. Migração de histórico Todoist — ❌ Não por enquanto
Só tarefas ativas vêm.

---

## 🟡 ABERTAS PARA AMANHÃ

- **Cloudflare**: guiar setup passo-a-passo + domínio
- **GitHub**: push via PAT ou `gh auth login`

---

## Log de decisões

```
[2026-04-17] Stack confirmada: Next 15 + Bun + Supabase + CF + Zustand + Framer + Tone + shadcn + next-pwa
[2026-04-17] Design: obsidian + jade (#198B74 / #2CAF93)
[2026-04-17] Swipe: ESQUERDA=pular, DIREITA=voltar, CIMA=adiar manual, BAIXO=adiar auto
[2026-04-17] Single-user MVP; schema já multi-tenant-ready
[2026-04-17] Projeto Supabase produção: jtpfauouvbtmhgrszybk
[2026-04-17] Credenciais (Supabase/Todoist/Anthropic) recebidas e em .env.local
[2026-04-17] Auth: Magic Link email
[2026-04-17] Adiar no TinDo reflete due date no Todoist
[2026-04-17] PWA first no iPhone; monetização pública vem depois
```
