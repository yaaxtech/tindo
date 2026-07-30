# 08 — Spec da Fase 1 (MVP)

Type: grilling
Status: resolved
Blocked by: 04, 05, 06, 09

## Question

Escrever a spec da Fase 1 (skill `superpowers:writing-plans`), consolidando: inventário (01), libs (02, 03), schema (04) e decisões de UX dos protótipos (05, 06).

Deve cobrir: rotas (`/docs`), componentes, serviços (`src/services/`), migrations, critérios de aceite por entrega, e o corte exato do MVP (o que do inventário fica para Fase 2+). Fechar com o dono o corte final.

Resolver este ticket é cruzar a linha de chegada do planejamento: depois dele começa a implementação do MVP (que faz parte do destino deste mapa — "spec fechada + MVP no ar").

## Answer

Spec fechada em [`docs/superpowers/plans/2026-07-30-roadmapmind-fase-1-mvp.md`](../../../docs/superpowers/plans/2026-07-30-roadmapmind-fase-1-mvp.md) (formato `superpowers:writing-plans`, executável fatia a fatia).

- **Corte fechado com o dono (2026-07-30):** tabela "Corte do MVP" na spec. Espelhos **entram** na Fase 1 como última fatia (adiável para "Fase 1.5" se apertar o prazo, sem bloquear as anteriores). Auth segue o padrão vigente do app (service role + `getUsuarioIdMVP`), com schema já RLS-ready — não cria login real agora. Tarefas não numeram; foco sobe hierarquia (H3→H2); botão de exportar markdown fica pós-MVP (RPC pronta).
- **9 fatias (PRs incrementais mergeáveis):** 0 fundação (deps/config/schema/RPCs/service/rota) · 1 editor+persistência · 2 outline rico · 3 tarefas hierárquicas · 4 mapa visualização · 5 mapa edição · 6 documentos aninhados+menu · 7 espelhos · 8 menu TinDo+polish+mobile.
- **SQL completo na spec** (doc_linhas + doc_espelhos + 3 RPCs) — fica com o cérebro (regra do dono); frontend pode ir a worker.
- **Contrato Fase 3 respeitado** desde já (escrita única em `services/doc.ts`, ids estáveis, upsert idempotente, nome `doc_yjs_state` reservado).
- **Self-review de cobertura** (tickets 01–09) incluída no fim da spec, sem gaps não-intencionais.

Destino do mapa agora: **spec fechada ✅ → falta o MVP no ar** (implementação das 9 fatias).
