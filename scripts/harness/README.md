# Runtime do Painel do Harness

## Roteamento e experimentos (15/09/2026)

A configuração operacional é `~/.claude/orquestracao/defaults-terreno.json`.
O arquivo `defaults-terreno.example.json` é uma fixture pública de teste, sem
contas ou credenciais; não substitui a configuração pessoal.

- `rota-harness.mjs resolver --frente codex --terreno rotina`: resolve o par
  para um novo despacho, com versão da configuração e atribuição experimental.
- `despachar-harness.mjs --frente codex --terreno rotina --prompt-file /caminho/prompt.txt`:
  executa a rota e tenta o outro provedor uma vez quando há indisponibilidade.
- `codex-run.sh` é a versão revisável de `~/.claude/workers/codex/run.sh`.
  Flags antigas do construtor são substituídas pelo default resolvido; escalada
  consciente exige motivo de fallback ou `ROTEAMENTO_OK`, registrado no ledger.
  Revisor continua explícito e sujeito à validação de autoria e provedor.
- `codex-eventos.mjs` captura a sessão do evento `thread.started` desta
  execução. Modelo/esforço só são confirmados com o `turn_context` dessa sessão.
- `experimentos-harness.mjs` não transforma histórico comum em A/B. Conta
  apenas registros atribuídos à mesma versão de protocolo; tokens ausentes,
  sessões compartilhadas e modelos não confirmados não autorizam promoção.
- `autorregular-experimentos.mjs` roda no publicador horário existente e
  mantém registro anterior/posterior de cada mudança. Não lança tarefas de LLM.
- `arena-benchmark.mjs` atualiza semanalmente a referência externa na mesma
  publicação; falha de consulta preserva a amostra datada anterior.

Instalação local exige backup dos arquivos substituídos: módulos em
`~/.claude/orquestracao/`, wrapper em `~/.claude/workers/codex/run.sh`. A edição
da configuração real é feita separadamente, preservando contas e credenciais.
Executar `publicar-painel.mjs --dry-run --dump /tmp/snapshot.json` verifica o
payload sem publicar nem aplicar decisões. O ciclo normal publica apenas
telemetria estruturada, nunca prompts nem identificadores de sessão.

Para subagentes nativos, o agente deve usar o par resolvido explicitamente e
registrar o despacho. A ferramenta não consegue mudar retroativamente o modelo
da conversa atual. Logs antigos sem classificação continuam fora das decisões.

Os arquivos de `runtime/` são a versão revisável dos coletores instalados em
`~/.claude/orquestracao/`. Eles usam as dependências operacionais já existentes
naquele diretório (`painel.mjs`, `paridade-terrenos.mjs` e suas dependências).
Não execute o publicador a partir desta pasta: ele deve ser instalado junto
às dependências. A entrada do launchd é `atualizar-fontes.mjs`, que atualiza o
snapshot principal e o GitHub separadamente; erro em uma fonte não congela outra.

A coleta do GitHub usa a autenticação local do `gh`; apenas metadados previstos
no contrato público são enviados. Não carrega títulos de PR ou mensagens de
commit. `coletar-actions.mjs --dump /tmp/revisao.json` coleta e salva o cache local,
mas não publica; o arquivo `.runs.json` acompanhante contém o lote revisável.

`runtime/telemetria-codex.mjs` é instalado junto aos demais arquivos de runtime. O consumo
Codex permanece separado de Claude: os provedores contabilizam tokens de forma
diferente. Perguntas Codex não são convertidas em aceite/correção por heurística.
Durações antigas sem medição e tokens por entrega sem vínculo ficam sem valor;
a coleta nunca inventa dados para melhorar cobertura. Kimi permanece identificado
como frente histórica, sem ser recomendado como assinatura ativa.

## Validação

```
node --test scripts/harness/runtime/metricas-snapshot.test.mjs scripts/harness/runtime/janela.test.mjs scripts/harness/runtime/telemetria-codex.test.mjs
node scripts/harness/runtime/coletar-actions.mjs --self-test
```

A restauração da tabela de minutos usa somente a migration já versionada
`supabase/migrations/20260813000005_harness_actions_snapshot.sql`. Antes de aplicar,
confira ausência no catálogo, execute em transação com rollback e valide RLS:
leitura pública conforme o painel existente, escrita exclusiva de service_role.
Não rode `scripts/apply-migrations.ts` nesta reparação: ele aplicaria migrations
alheias ao escopo.

Para recompor o cache de jobs sem repetir a listagem de runs, um inventário
gerado por `--dump` pode ser reutilizado com
`--inventario /tmp/revisao.json.runs.json --dump /tmp/backfill.json`. Esse modo
é estritamente local e não pode publicar: o ciclo normal precisa consultar o
GitHub novamente antes de atualizar as datas no painel. O orçamento por
execução continua limitado por `ACTIONS_TETO` e a coleta para novas chamadas
de jobs quando identifica esgotamento da quota.

Os tempos de entrega (`harness_github_runs`) são exclusivos de `yaaxtech/tindo`;
o snapshot de minutos continua cobrindo os dois repositórios. PRs são identificados
por repositório e número, nunca apenas pelo número.

Tokens incluem releituras reais de contexto em novas execuções/forks. Cópias do
mesmo evento de log são deduplicadas; não se desconta uma leitura efetivamente
feita por outro fluxo apenas porque o texto do contexto era compartilhado.
