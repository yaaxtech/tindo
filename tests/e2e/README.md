# Testes E2E — TinDo (Playwright)

## Pre-requisitos

1. **Dependências instaladas**: `bun install`
2. **Chromium instalado**: `bunx playwright install chromium`
   - Se a instalação falhar por permissão, rode: `sudo bunx playwright install --with-deps chromium`
3. **`.env.local` configurado** na raiz do projeto (Supabase URL/Key + TINDO_MVP_USER_ID)

## Como rodar

```bash
# Rodar todos os testes (inicia dev server automaticamente se não estiver rodando)
bun run e2e

# Rodar apenas um projeto
bunx playwright test --project=desktop-chrome
bunx playwright test --project=mobile-safari

# Rodar arquivo específico
bunx playwright test tests/e2e/01-landing.spec.ts
```

## Como debugar

```bash
# Interface visual (recomendado para desenvolvimento)
bun run e2e:ui

# Modo passo-a-passo com inspetor
bun run e2e:debug

# Ver relatório HTML do último run
bunx playwright show-report
```

## Estrutura dos testes

| Arquivo | O que testa |
|---------|-------------|
| `01-landing.spec.ts` | Rota `/`, title, manifest |
| `02-cards.spec.ts` | Tela principal, contador, teclado |
| `03-tarefas-crud.spec.ts` | Lista, modal criar/fechar |
| `04-sugestoes-inbox.spec.ts` | `/sugestoes-ia`, botão analisar, filtros |
| `05-recalibrar.spec.ts` | `/recalibrar`, KPIs, passo 1 |
| `06-configuracoes.spec.ts` | `/configuracoes`, seção IA, sliders |

## Autenticação (modo MVP)

Os testes usam `login()` de `fixtures.ts`. Em modo MVP (single-user), assume-se que
há uma sessão ativa via cookie/localStorage ou que `TINDO_MVP_USER_ID` está configurado.

Se não houver sessão ativa, os testes que dependem de autenticação são **automaticamente pulados**
(`test.skip`) com um warning no console — não falham, apenas reportam como "skipped".

Para rodar com autenticação real:
- Configure cookies de sessão via `storageState` no `playwright.config.ts`
- Ou use a rota `/login` com Magic Link manualmente antes de rodar os testes

## Nota sobre manifest

O next-pwa desabilita o manifest em desenvolvimento (`NODE_ENV=development`).
O teste `01-landing` pula automaticamente se o manifest não estiver disponível.
Para testar o manifest: `bun run build && bun run start && bun run e2e`.
