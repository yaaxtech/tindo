# REVIEW.md — regras do revisor do TinDo

Lido na revisão de diff, não na implementação. Fonte: post "Solving code
review at Anthropic" (claude.dev, out/2026). Regra mecânica vira check
(Biome, typecheck, teste), não linha aqui.

- **O que é falha aqui:** a nota de prioridade sai diferente do que
  `docs/02_SCORING.md` define; a sincronização com o Todoist perde, duplica
  ou conclui tarefa errada (`docs/05_TODOIST.md`); um usuário vê tarefa de
  outro (RLS); XP/gamificação conta em dobro.
- **Evidência:** path:linha ou output de comando. Suspeita tirada só do nome
  de função não é achado.
- **Pré-existente:** linha que já existia antes do diff (`git blame`) vai
  para a seção PRÉ-EXISTENTES e não reprova o PR.
- **Classe de bug:** liste todas as ocorrências do diff no mesmo item.
- **Nits:** no máximo 3 por parecer, sempre P2.
- **Pule:** `bun.lock`, `.open-next/`, `tsconfig.tsbuildinfo`, `*.xlsx` e
  arquivos gerados.
- **Rodadas:** da 2ª em diante, revise só o diff novo e não repita achado já
  postado. Na 3ª rodada reprovada, o autor revê a abordagem.
- **Resumo:** começa pela contagem ("2 P1, 1 P2") ou diz "nada a corrigir".
- **Severidade:** P0/P1 bloqueia o artefato afetado; P2 vira débito.
