# PERGUNTAS ABERTAS — decisões pendentes do humano

> Atualizar este arquivo sempre que uma decisão for tomada (move pra `docs/` correspondente).

---

## 🔴 BLOQUEANTES (precisam de resposta pra avançar em fases específicas)

### Q1. Credenciais Supabase
- **Projeto**: `jtpfauouvbtmhgrszybk` (URL: https://jtpfauouvbtmhgrszybk.supabase.co)
- **Necessito**:
  - [ ] `SUPABASE_ANON_KEY` (public, client-side)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (server-only, para endpoints de sync e cron)
  - [ ] Database password (para CLI `supabase db push`)
- **Onde pegar**: https://supabase.com/dashboard/project/jtpfauouvbtmhgrszybk/settings/api
- **Bloqueia**: Fase 0 (parte real do backend) e todas posteriores

### Q2. Todoist API token
- **Necessito**: token pessoal de API
- **Onde pegar**: Todoist → Settings → Integrations → Developer → API token
- **Bloqueia**: Fase 3 (sync). Pode ser postponado, código fica com mock.

### Q3. Anthropic API key (Claude)
- **Necessito**: API key
- **Onde pegar**: https://console.anthropic.com/settings/keys
- **Bloqueia**: Fase 7+. Também pode ser postponado.

### Q4. Cloudflare Pages setup
- **Necessito**:
  - [ ] Confirmar: criou conta Cloudflare?
  - [ ] Quero guiar você no setup (login → conectar GitHub → criar projeto)?
  - [ ] Domínio final: `tindo.yaax.tech` ou outro?
- **Bloqueia**: deploy produção (Fase 11). Dev local não precisa.

### Q5. Repositório GitHub
- **URL mencionada**: https://github.com/yaaxtech/tindo
- **Perguntas**:
  - [ ] Confirma que está vazio/pronto para receber o push inicial?
  - [ ] Privado ou público?
  - [ ] Você tem `gh` CLI autenticado localmente? (pra eu conseguir push)

---

## 🟡 DE PRODUTO (precisam de input pra implementação correta)

### Q6. Convenção do swipe
> Minha proposta (ver `docs/03_UI_UX.md`):
> - **→ DIREITA** = PULAR (próxima)
> - **← ESQUERDA** = VOLTAR (anterior)
> - **↑ CIMA** = adiar manual
> - **↓ BAIXO** = adiar automático

> Sua descrição no briefing:
> - "(Pra tras): Pularia e viriamos a tarefa posterior"
> - "(Pra frente): Voltaríamos pra ultima tarefa mostrada"

**Interpretação**: você provavelmente quis dizer "empurrar a tarefa pra trás na fila = pular". Mas isso inverte o instinto visual.

- [ ] Confirma: **direita=pular**, **esquerda=voltar**? (default proposto)
- [ ] Ou prefere o inverso?

### Q7. Autenticação
- [ ] Magic Link por email (mais simples, sem senha) — **default proposto**
- [ ] Google OAuth
- [ ] OTP WhatsApp (reusando Z-API do SeuCamarão)
- [ ] Múltiplos métodos desde o início

### Q8. Adiar no TinDo → reflete data no Todoist?
- [ ] **Sim**: mudança de `adiada_ate` atualiza `due.date` no Todoist — **default proposto**
- [ ] **Não**: adiamento é local ao TinDo

### Q9. Fila principal: todas tarefas ou só "para hoje"?
- [ ] **Todas pendentes** (ordenadas por nota) — **default proposto**
- [ ] Só tarefas com data para hoje + lembretes
- [ ] Usuário escolhe em configurações

### Q10. Volume de tarefas atual no Todoist
- Quantas tarefas hoje (aproximado)?
- Me ajuda a dimensionar paginação/performance.

---

## 🟢 FUTURAS (podem ficar pra depois, mas bom deixar registrado)

### Q11. Monetização
- O TinDo é só pra você usar ou vai virar produto público?
- Se público: gratuito / freemium / pago? Afeta arquitetura (multi-tenant vs single-tenant, billing).

### Q12. Dispositivos principais
- iPhone, Android, ambos?
- Vamos fazer app nativo no futuro (React Native / Capacitor) ou só PWA?

### Q13. Sons customizados
- Os sons são sintetizados com Tone.js (default). Você tem preferência sonora / referência (ex: "Duolingo-like", "Apple Watch-like", "custom jade pack")?

### Q14. Notificações push
- Quer notificações push (ex: "boa hora pra concluir suas rápidas")?
- Quando? Web Push API ou só in-app?

### Q15. Idioma
- PT-BR default. Inglês e outros no futuro?

### Q16. Dados existentes
- Você quer migrar tarefas antigas já concluídas do Todoist pro histórico do TinDo (pra alimentar IA/gamificação)?

---

## Arquivo de decisões

À medida que eu (ou você) toma decisão, logar aqui:

```
[2026-04-17] Stack confirmada: Next 15 + Bun + Supabase + CF + Zustand + Framer + Tone + shadcn + next-pwa
[2026-04-17] Design: obsidian + jade (#198B74 / #2CAF93)
[2026-04-17] Proposta swipe: DIREITA=pular, ESQUERDA=voltar, CIMA=adiar manual, BAIXO=adiar auto
[2026-04-17] Single-user no MVP; schema já com usuario_id prevendo multi-tenant
[2026-04-17] Projeto Supabase: jtpfauouvbtmhgrszybk (produção)
```
