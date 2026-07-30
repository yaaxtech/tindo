# Pesquisa 07 — Colaboração simultânea (Fase 3) para o RoadmapMind

Data: 2026-07-30 · Ticket: `.scratch/roadmapmind/issues/07-tech-colaboracao-simultanea.md`
Contexto herdado: editor BlockNote + Yjs (ticket 02); verdade persistida = Postgres, tabela `doc_linhas` com id de bloco estável, `pai_id`, `ordem` fracional, `updated_at` por linha (ticket 04).

## 1. Híbrido "Yjs como transporte, Postgres como verdade" — é padrão documentado? SIM

- O Hocuspocus documenta exatamente esse fluxo: carregar o doc no `onLoadDocument` e persistir no `onStoreDocument`, que já vem com **debounce configurável** (default 2s, máx. 10s) e retry se o hook lançar erro ([Persistence — Hocuspocus Docs](https://tiptap.dev/docs/hocuspocus/guides/persistence), [Hooks](https://tiptap.dev/docs/hocuspocus/server/hooks)).
- Desde a v4, `onStoreDocument` dispara em qualquer mudança do documento, não só as vindas de WebSocket.
- Há tutorial dedicado de Hocuspocus + Supabase Postgres ([Emergence Engineering](https://emergence-engineering.com/blog/hocuspocus-with-supabase)).
- y-partyserver (Cloudflare) expõe hooks equivalentes (`onLoad`/`onSave`) para carregar/salvar o doc Yjs em storage externo ([y-partyserver README](https://github.com/cloudflare/partykit/blob/main/packages/partyserver/README.md)).
- **Como reconciliar Yjs ↔ `doc_linhas`:** no `onStoreDocument`, iterar os blocos do doc BlockNote (cada bloco tem o mesmo uuid da linha) e fazer upsert por id + soft-delete das linhas ausentes; comparar hash/`updated_at` para tocar só as linhas mudadas. Recomendação prática: persistir TAMBÉM o snapshot binário Yjs (`Y.encodeStateAsUpdate`) numa tabela `doc_yjs_state (doc_id, state bytea)` — recarregar sessão a partir do binário evita divergência de reconstrução (reconstruir um Y.Doc a partir das linhas gera um doc "novo" sem histórico CRDT, o que quebra merge com clientes offline).
- **Risco de divergência principal:** duas fontes de escrita no Postgres (Yjs→linhas e edições diretas nas linhas fora do editor). Regra: enquanto um doc está em sessão colaborativa, o editor Yjs é o único escritor das suas linhas; edição externa entra VIA doc Yjs (aplicar update no servidor), nunca direto na tabela.

## 2. Alternativa sem CRDT: Supabase Realtime + LWW por linha

Viável para 2–10 editores porque as linhas são pequenas e têm id estável; Broadcast é o canal recomendado pela Supabase para eventos colaborativos de alta frequência ([Realtime docs](https://supabase.com/docs/guides/realtime), [Broadcast](https://supabase.com/features/realtime-broadcast)).

Onde quebra:
- **Dois digitando na MESMA linha:** LWW descarta a digitação de um deles a cada save — sem merge por caractere. Com 2–10 pessoas numa reunião editando o mesmo outline, colisão na mesma linha é plausível (a pessoa "escriba" + alguém corrigindo).
- **Moves concorrentes na árvore:** LWW em `pai_id`/`ordem` pode gerar ciclo (A move X para dentro de Y enquanto B move Y para dentro de X) — precisa de validação server-side anti-ciclo; Yjs não resolve isso magicamente também, mas o problema fica igual ou pior no LWW.
- **Sem suporte offline/merge tardio.** E o BlockNote já tem o caminho Yjs pronto (`withCollaboration`); fazer LWW por linha significa escrever sincronização própria sobre um editor que fala Yjs nativamente — mais código nosso, não menos.
- O provider comunitário `y-supabase` (Yjs sobre Supabase Realtime) existe mas se declara imaturo/não-produção ([y-supabase](https://github.com/AlexDunmow/y-supabase)).

Veredito: LWW por linha "funciona no demo", mas o custo de engenharia própria + os dois modos de quebra acima tornam Yjs mais barato no total, já que o editor já o suporta.

## 3. Providers Yjs em 2026 — onde rodar e custo

| Opção | Onde roda | Custo/mês no nosso tamanho | Notas |
|---|---|---|---|
| **Supabase Edge Functions** | — | — | **DESCARTADO**: wall-clock máx. 150s (free) / 400s (pago) por worker, WebSocket cai junto ([Limits](https://supabase.com/docs/guides/functions/limits), [discussion #32791](https://github.com/orgs/supabase/discussions/32791)). Não serve para sala persistente. |
| **y-partyserver (PartyKit → Cloudflare)** | Durable Objects | **US$0–5** (DO no plano free: 100k req/dia, 5GB SQLite; Workers Paid US$5; hibernation zera duração ociosa; mensagens WS entrantes cobradas 20:1) ([DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing), [changelog](https://developers.cloudflare.com/changelog/product/durable-objects/)) | PartyKit foi adquirido pela Cloudflare (2024) e vive como `partyserver`/`y-partyserver`, mantido ativamente no repo cloudflare/partykit. BlockNote tem exemplo oficial ([PartyKit example](https://www.blocknotejs.org/examples/collaboration/partykit)). Já estamos na Cloudflare (Pages). |
| **Hocuspocus self-host** | Railway/Fly (processo Node persistente) | ~US$5 (instância mínima) | Hooks de persistência mais maduros e documentados; +1 serviço para operar. |
| **y-sweet (Jamsocket)** | Gerenciado (backing S3) | Free tier 10GB de storage no plano gratuito; página de pricing não acessível na pesquisa — confirmar antes de escolher ([y-sweet](https://github.com/jamsocket/y-sweet)) | Exemplo oficial no BlockNote. Risco: dependência de startup pequena. |
| **Liveblocks** | Gerenciado | Free: 500 rooms ativos/mês; Pro US$25/mês ([Pricing](https://liveblocks.io/pricing)) | Integração BlockNote de primeira classe, presença/comments prontos. Mais caro e vendor lock-in maior. |

## 4. Recomendação e contrato mínimo

**Recomendação (Fase 3):** BlockNote `withCollaboration` + **y-partyserver em Cloudflare Durable Objects** (US$0–5/mês, mesmo provedor do Pages, hooks `onLoad`/`onSave` para o padrão híbrido). Fallback igualmente válido se preferirmos hooks mais maduros: Hocuspocus num Railway/Fly a ~US$5. Persistência: debounce de ~2s salvando (a) snapshot Yjs binário em `doc_yjs_state` e (b) upsert das `doc_linhas` mudadas — Postgres segue sendo a verdade de leitura/consulta; o binário Yjs é a verdade de MERGE.

**Contrato mínimo que o MVP (Fase 1, sem colaboração) deve respeitar:**
1. id do bloco BlockNote = id da linha (uuid estável, nunca regenerado em edição/move). ✔ já no schema 04.
2. Conteúdo da linha persistido como o jsonb do bloco BlockNote (não só markdown). ✔.
3. `ordem` por fractional indexing + `pai_id` — move = update de 1 linha. ✔.
4. `updated_at` por linha + soft delete. ✔.
5. **Toda escrita passa por uma camada de serviço única** (`services/doc.ts`) — na Fase 3 essa camada troca o alvo (Postgres direto → doc Yjs) sem mexer nos componentes. Exigir desde já.
6. **Faltando no schema 04:** prever a tabela `doc_yjs_state (doc_id uuid PK, state bytea, updated_at)` — não precisa criar no MVP, só não usar o nome; e nenhuma lógica do MVP pode assumir que ela mesma é a única escritora das linhas (idempotência nos upserts).
7. MVP deve usar o BlockNote de forma compatível com `withCollaboration` (não guardar estado do editor fora do doc).

Conclusão: o schema do ticket 04 **já cumpre** o essencial; os únicos acréscimos são a camada de serviço única e a reserva da tabela de snapshot Yjs.

## Fontes principais

- https://tiptap.dev/docs/hocuspocus/guides/persistence
- https://tiptap.dev/docs/hocuspocus/server/hooks
- https://emergence-engineering.com/blog/hocuspocus-with-supabase
- https://github.com/cloudflare/partykit (partyserver / y-partyserver)
- https://developers.cloudflare.com/durable-objects/platform/pricing
- https://supabase.com/docs/guides/functions/limits · https://github.com/orgs/supabase/discussions/32791
- https://www.blocknotejs.org/docs/features/collaboration (+ exemplos PartyKit, Y-Sweet, Liveblocks)
- https://liveblocks.io/pricing
- https://github.com/jamsocket/y-sweet
- https://github.com/AlexDunmow/y-supabase
- https://supabase.com/docs/guides/realtime · https://supabase.com/features/realtime-broadcast
