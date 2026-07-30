# 09 — Uma filha com várias mães (espelhos)

Type: grilling
Status: resolved
Blocked by: —

## Question

Requisito novo do dono (2026-07-30, durante o protótipo 05): **uma linha pode ter mais de uma mãe**. A mesma linha aparece sob duas (ou mais) mães diferentes, e é UMA só — editar em qualquer lugar reflete em todos ("edição síncrona").

Decidir e documentar:
1. Modelo: aresta plena (tabela `doc_arestas(mae_id, filha_id, ordem)` substituindo `pai_id`) vs **espelho** (a linha tem uma mãe "principal" + arestas de espelho nas demais — modelo do Workflowy). O espelho preserva semânticas simples de exclusão e de "onde a linha mora".
2. Exclusão: apagar o espelho ≠ apagar a linha; apagar a original faz o quê (promove um espelho? apaga tudo com aviso)?
3. Ciclo: linha não pode virar descendente de si mesma por nenhum caminho — onde valida (RPC `mover_linha` + criação de espelho).
4. Compartilhamento (Fase 2): linha alcançável por duas mães com permissões diferentes — a permissão é da linha via QUAL caminho?
5. Efeitos em: numeração/markdown export (linha aparece 2×), mindmap (nó duplicado ou aresta extra?), contrato Yjs da Fase 3, RPC `documento_como_markdown` (evitar loop).
6. UI: como criar um espelho (comando /, arrastar com modificador?) e como sinalizar visualmente que a linha é espelhada.

Impacto: **emenda o schema do ticket 04** (que assumia `pai_id` único). Resolver ANTES da spec (08).

## Answer

**Modelo espelho** (decidido pelo dono em 2026-07-30, opção recomendada).

1. **Modelo:** a linha mantém sua casa principal (`pai_id` em `doc_linhas`, como no ticket 04). Espelhos viram tabela nova:
   ```sql
   CREATE TABLE public.doc_espelhos (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     usuario_id uuid NOT NULL REFERENCES auth.users(id),
     linha_id uuid NOT NULL REFERENCES public.doc_linhas(id),  -- a linha original
     mae_id uuid NOT NULL REFERENCES public.doc_linhas(id),    -- onde o espelho aparece
     ordem text NOT NULL,               -- fractional index entre os irmãos da mãe
     created_at timestamptz NOT NULL DEFAULT now(),
     deleted_at timestamptz NULL,
     UNIQUE (linha_id, mae_id)
   );
   ```
   O conteúdo NÃO é duplicado — o espelho referencia a linha; editar em qualquer lugar edita a única linha ("edição síncrona" de graça).
2. **Exclusão:** apagar espelho = soft delete só em `doc_espelhos`. Apagar a original = aviso ("esta linha tem N espelhos") com opções: apagar tudo, ou promover um espelho a nova casa principal.
3. **Ciclo:** `mover_linha` E criação de espelho validam que o destino não é descendente da linha (considerando também caminhos via espelhos). Validação na RPC, com CTE recursiva.
4. **Compartilhamento (Fase 2):** permissão herda pelo caminho REAL (`pai_id`). O espelho só aparece para quem já tem acesso à linha original por algum caminho — espelho não expande acesso (regra conservadora; revisitar na spec da Fase 2 se apertar).
5. **Efeitos:** `documento_como_markdown` inclui espelhos com marcação (e corta recursão por visitados); numeração conta o espelho na posição onde aparece; mindmap desenha o espelho como nó com iconezinho (↻) e aresta pontilhada; contrato Yjs inalterado (espelho é estrutura, não conteúdo).
6. **UI:** criar espelho = arrastar nó com `Alt` pressionado (mapa) ou comando "/espelhar em…" (editor); espelho sinalizado com ícone ↻ discreto no editor e no mapa.

Emenda registrada no ticket 04. Fase 1 (MVP) já cria a tabela e a UI mínima de espelhar; refinamentos de compartilhamento com espelho ficam na Fase 2.
