# 07 — Tech de colaboração simultânea (Fase 3)

Type: research
Status: resolved
Blocked by: 02, 04

## Question

Qual tecnologia sustenta a edição simultânea estilo Google Docs na Fase 3 — e o que o MVP precisa respeitar DESDE JÁ para não fechar essa porta?

Avaliar:
1. Yjs (CRDT) com o editor escolhido no 02 — qual provider: y-websocket auto-hospedado, Liveblocks, PartyKit/Cloudflare Durable Objects, ou Supabase Realtime como transporte?
2. Alternativa sem CRDT: Supabase Realtime (Postgres Changes/Broadcast) com last-write-wins por NÓ — dado que nosso modelo é árvore de nós (linhas pequenas), conflito por caractere é raro; isso basta?
3. Como cada opção convive com o schema do 04 (a verdade fica no Postgres; CRDT como camada de transporte, ou documento CRDT como verdade?).
4. Custo mensal e complexidade operacional de cada caminho (o TinDo roda em Cloudflare Pages + Supabase hosted).

Entregável: recomendação com evidência + o contrato mínimo que o MVP deve respeitar (ex.: ids estáveis por nó, updates por nó, timestamps) para a Fase 3 encaixar sem reescrita.

## Answer

**Recomendação:** BlockNote `withCollaboration` (Yjs) + y-partyserver em Cloudflare Durable Objects (US$0–5/mês; mesmo provedor do Pages; PartyKit é da Cloudflare desde 2024 e mantido). Fallback: Hocuspocus self-host em Railway/Fly (~US$5) — hooks de persistência mais maduros. Supabase Edge Functions DESCARTADO (wall-clock 150–400s mata WebSocket). LWW por linha via Supabase Realtime descartado: quebra com dois na mesma linha e moves concorrentes, e exigiria sync próprio num editor que já fala Yjs.
**Padrão híbrido (documentado):** Yjs em memória na sessão; `onStoreDocument`/`onSave` com debounce ~2s faz upsert das `doc_linhas` mudadas E salva snapshot binário Yjs em `doc_yjs_state`. Postgres = verdade de leitura; binário Yjs = verdade de merge. Durante sessão colaborativa, só o doc Yjs escreve nas linhas.
**Contrato mínimo do MVP (Fase 1):** id do bloco = id da linha (uuid estável); conteúdo jsonb do bloco; `pai_id` + `ordem` fracional; `updated_at` + soft delete — o schema do ticket 04 JÁ cumpre. Faltam só: (a) toda escrita via camada de serviço única (`services/doc.ts`), (b) reservar o nome `doc_yjs_state` para a tabela de snapshot, (c) upserts idempotentes.
Comparativo completo com fontes: `.scratch/roadmapmind/research/07-tech-colaboracao-simultanea.md`.
