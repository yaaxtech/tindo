# Ciclo de vida da memória do harness — retenção, decaimento, promoção

> Origem: auditoria ultracode de 2026-07-12 (23 agentes + verificação
> adversarial) sobre todos os estoques de conhecimento: memória persistente
> (~115 arquivos + MEMORY.md), CLAUDE.md (13 gotchas + LEARNED), 16 skills,
> ~1.140 reflexões arquivadas, git. Veredito: compounding REAL para bugs de
> conhecimento/domínio; só ACÚMULO para bugs estruturais/de-processo.
> Portado do padrão SeuCamarão (2026-07-30) — política é genérica, não
> depende do domínio do projeto. Executores: `[ASSIST]` = assistente em
> sessão · `[L3]` = faxineiro-reflexoes · `[L10]` = frescor-skills · `[HOOK]`
> = stop-reflect.sh · `[DONO]` = humano.

## Camadas e o que cada uma custa

| Camada | Custo | Papel |
|---|---|---|
| Gotcha G-XX + LEARNED (CLAUDE.md) | fixo, toda sessão | regra anti-regressão universal; só o que corrompe dados/dinheiro ou reincide |
| MEMORY.md (índice) | fixo, toda sessão | ganchos de 1 linha; é o mapa de busca E a fila de pendências |
| memória-corpo (`memory/*.md`) | sob demanda | forense, números, estado; aberta pelo gancho ou por skill |
| skill (`.claude/skills/`) | sob demanda | procedimento recorrente, dispara por sintoma na description |
| subdir CLAUDE.md | fixo quando cwd entra | convenção local |
| reflexão (`.claude/reflections/`) | efêmero | fila de entrada bruta → L3 destila |

**Regra-mãe:** um fato sobe UMA camada por vez e só quando prova durabilidade.
**Nada nasce gotcha.**

## Orçamento (anti-inchaço do custo fixo)

- **Teto do índice: ~100 ganchos** (duro: 110). Estourou → despejar nesta
  ordem: (1) gancho cuja regra já virou G-XX; (2) snapshot de época stale;
  (3) gancho redundante com irmã indexada. **NUNCA** despejar pendência viva
  nem o último gancho de um cluster. `[L3]`/`[ASSIST]`
- **CLAUDE.md: ≤15 gotchas, ≤20 linhas LEARNED.** Gotcha novo entra → auditar
  se algum virou convenção pura (rebaixar p/ 1 linha LEARNED + skill). `[L3]`+`[DONO]`

## Promoção (subida)

- Achado de sessão nasce **reflexão** (`[HOOK]`). Exceção única: classe
  catástrofe (corrompe dinheiro/dados) pode virar linha LEARNED na hora, com
  OK do dono.
- Reflexão → gotcha/LEARNED **por repetição**: mesmo conceito em ≥2 reflexões
  (domínio) ou ≥3 (processo/loop). Ocorrência única não-catastrófica vira, no
  máximo, memória-corpo. `[L3]`
- Memória → skill: procedimento repetido em ≥3 memórias do mesmo cluster →
  consolidar o como-fazer na skill dona e rebaixar as memórias a ponteiros.
  **Curadoria manual** (o L9 destila `.claude/loops/*.md`, NÃO as skills de
  domínio — não confundir). `[ASSIST]`
- Estado/época, ocorrência única, nome-de-implementação e convenção-pura
  **nunca sobem**.

## Pendências (o buraco nº 1 da auditoria)

- Todo gancho de trabalho inacabado começa com **`⏳PENDENTE:`** + o SINTOMA
  que a tarefa futura buscaria (não o nome interno da função). `[ASSIST]`
- **PROIBIDO** gancho que afirma "pronto/RESOLVIDO/deployado" com pendência
  viva no corpo. Formato: `✅ <o que fechou> · ⏳PENDENTE: <o que falta>`.
  (Gancho enganoso é pior que ausente: dá falsa confiança e o corpo nunca é
  aberto.) `[L3]` varre semanalmente.
- Um corpo = um gancho (double-link é desperdício de índice).

## Decaimento (descida)

- **Zumbi resolvido** (corpo se declara encerrado E a regra vive num G-XX):
  remover o gancho; manter o corpo só se tiver forense única por trás do
  gotcha; senão mover para `memory/_archive/`. `[L3]`
- **Snapshot de época** (contagens, portas, baselines, PRs datados): destilar
  o fato durável para a memória-âncora do cluster e arquivar o snapshot.
  Snapshot nunca fica no índice ativo. `[L3]`/`[L10]`
- **Reflexão vazia/erro não entra na fila**: o gate do `[HOOK]` descarta
  (log em `.claude/loops/logs/reflect-descartes.log`), não arquiva esqueleto.

## Reincidência = gate, não texto (a lição central da auditoria)

Quando uma família JÁ documentada reincide, **parar de reescrever a
lição** — mover para o executor certo, marcando a proposta como
`[ESTRUTURAL→GATE]`:

- checklist não executado (ex.: `deleted_at` esquecido) → item obrigatório
  no `migration-reviewer`;
- multi-writer (colisão de timestamp) → check de `schema_migrations` no
  reviewer/pre-commit;
- anti-padrão reintroduzido em feature nova (ex.: `SECURITY DEFINER` sem
  guard) → teste/lint de CI.

## Contradições (REGRA ZERO operacional)

Memória que contradiz gotcha/doc: quem tem **código executável + doc canônico
do lado vence**; a memória divergente é corrigida (nunca ignorada em
silêncio). Playbooks operacionais conflitantes → fundir com condição datada.
