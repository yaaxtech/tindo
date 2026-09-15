#!/usr/bin/env bash
# Worker Codex — wrapper FINO sobre `codex exec` que registra o despacho no
# ledger automaticamente (fatia 2 da instrumentação, 2026-08-10). O uso é
# idêntico ao codex exec; tudo é repassado intacto:
#   ~/.claude/workers/codex/run.sh -m gpt-5.6-luna \
#     -c model_reasoning_effort="max" "<prompt>"
#
# Ao fim da execução grava linha provisória no ledger (resultado "pendente",
# com id) — o cérebro fecha após a revisão:
#   node ~/.claude/orquestracao/ledger.mjs fechar --resultado ok1 --id pXXX
# Quota do Codex ("You've hit your usage limit" / "5-hour message limit")
# vira "quota" direto, sem esperar revisão.
# Env: LEDGER_TERRENO (default rotina; ui|rotina|dificil|analise|mecanico|sql) · LEDGER_PAPEL construtor|revisor
#      (default construtor) · LEDGER_MODELO_AUTOR=<modelo> obrigatório em revisão ·
# LEDGER_FALLBACK_MOTIVO=<chave de fallback> · LEDGER_TAREFA (default: último
# argumento, que costuma ser o prompt) · LEDGER_ORQUESTRACAO=solo|fanout ·
# LEDGER_SUBAGENTES_PLANEJADOS=<n> · LEDGER_OFF=1 desliga o registro ·
# LEDGER_PREPARO_MAX_MIN (default 60) teto de sanidade do preparo ·
# CODEX_TIMEOUT_MIN (default 90) teto de execução; 0 desliga o cão de guarda.
set -euo pipefail

# Preparo do despacho: minutos que o cérebro passou escrevendo o enunciado
# antes desta chamada. O número JÁ VEM PRONTO de ~/.claude/hooks/marco-preparo.sh,
# que o calcula no PreToolUse — estritamente antes deste processo nascer. Aqui
# só se lê e se consome; nada é recalculado.
#
# POR QUE NÃO CALCULAR AQUI (regressão corrigida em 13/08/2026): a conta local
# lia `marco-atividade`, o mesmo arquivo que o hook `atividade` do PostToolUse
# reescreve no instante em que o despacho é lançado em background. Medido em
# bancada: 9 de 10 despachos gravaram 0,0 min no lugar dos 7 min reais, e 1 leu
# o arquivo no meio da troca e não mediu nada. Zero silencioso é pior que
# número ausente — o candidato não tem essa corrida.
#
# Sem candidato (chamada fora do harness, cron, ou guarda do hook barrando o
# número) sai VAZIO: registro sem medição fica null, nunca estimado.
_marco_grava() { # $1=arquivo $2=conteúdo — troca atômica, nunca derruba o worker
  printf '%s' "$2" >"$1.tmp.$$" 2>/dev/null &&
    mv -f "$1.tmp.$$" "$1" 2>/dev/null ||
    rm -f "$1.tmp.$$" 2>/dev/null || true
}

preparo_min() {
  local dir="${HARNESS_MARCOS_DIR:-$HOME/.claude/orquestracao/marcos}"
  local sid cand priv bruto teto
  sid="$(printf '%s' "${CLAUDE_CODE_SESSION_ID:-global}" | tr -c 'A-Za-z0-9._-' '_')"
  cand="$dir/$sid.candidato"
  priv="$cand.lido.$$"
  # Re-ancora a frente NESTE instante e ZERA a conta de tempo morto: desde
  # 14/08/2026 o preparo conta do início da frente até o despacho, então o
  # próximo despacho tem de partir daqui — senão herdaria este preparo somado
  # ao tempo do worker que acabou de nascer em background. O morto acumulado já
  # foi descontado deste número; deixá-lo de pé o descontaria DE NOVO no
  # próximo, e a subtração dupla apaga a medição inteira.
  _marco_grava "$dir/$sid.ancora" "$(date +%s)"
  _marco_grava "$dir/$sid.morto" 0
  # Consome ATOMICAMENTE: o `mv` entrega o arquivo a UM processo só. Ler com
  # `cat` e apagar depois abre janela para dois despachos simultâneos lerem o
  # MESMO preparo — medido em bancada: 25 rodadas com 2 run.sh ao mesmo tempo,
  # 50 registros carregando o mesmo número. Preparo contado duas vezes infla a
  # mediana do KPI sem nada quebrar, que é o tipo de erro que ninguém percebe.
  mv -f "$cand" "$priv" 2>/dev/null || return 0
  bruto="$(cat "$priv" 2>/dev/null || true)"
  rm -f "$priv" 2>/dev/null || true
  # Só decimal não-negativo passa (o hook grava "%.1f"). Lixo, arquivo pela
  # metade ou "." sozinho não viram número.
  case "$bruto" in ''|.|*[!0-9.]*|*.*.*) return 0 ;; esac
  # Teto com lixo cai no default: `abc` vira 0 no awk e reprovaria TODA medição
  # em silêncio (do outro lado, no hook, viraria teto 0 pelo mesmo motivo).
  teto="${LEDGER_PREPARO_MAX_MIN:-60}"
  case "$teto" in ''|*[!0-9]*) teto=60 ;; esac
  awk -v v="$bruto" -v t="$teto" 'BEGIN{ if (v+0 >= 0 && v+0 <= t) printf "%.1f", v+0 }'
}

command -v "${HARNESS_CODEX_BIN:-codex}" >/dev/null 2>&1 || {
  echo "codex CLI não encontrado no PATH." >&2
  exit 1
}

# Extrai modelo/effort dos args SÓ para o registro (nada é alterado). Esta
# leitura subiu para ANTES do preparo em 17/08/2026: a guarda de roteamento
# abaixo precisa do modelo, e precisa decidir antes de o carimbo de preparo ser
# consumido — despacho barrado não deve gastar a medição.
# ── TRADUÇÃO DE `--effort` (18-19/08/2026) ────────────────────────────────────
# `--effort max` NÃO existe no `codex exec`: ele responde
# `error: unexpected argument '--effort' found`, sai rc=2 e o despacho morre em
# 0 min sem rodar nada. O jeito que o CLI aceita é `-c model_reasoning_effort=…`.
#
# Por que traduzir em vez de só documentar: quem monta o comando é um AGENTE
# lendo o CLAUDE.md, e o CLAUDE.md fala em "effort max" — a forma natural de
# escrever isso é `--effort max`. Medido em 19/08: o item B-470 tentou 5 vezes
# ao longo da madrugada, 3 delas morreram exatamente aqui, e o item voltou para
# a fila 8 vezes sem nunca sair do lugar. Regra que depende de decorar sintaxe
# vira falha silenciosa; tradução no wrapper vira mecanismo.
#
# Aceita `--effort X`, `--effort=X` e `-e X`. Se o chamador já mandou o `-c`
# certo, nada muda.
ARGS_TRADUZIDOS=()
PREV_T=""
for a in "$@"; do
  case "$PREV_T" in
    --effort|-e)
      ARGS_TRADUZIDOS+=(-c "model_reasoning_effort=\"$a\"")
      PREV_T="$a"; continue ;;
  esac
  case "$a" in
    --effort|-e) PREV_T="$a"; continue ;;
    --effort=*)
      ARGS_TRADUZIDOS+=(-c "model_reasoning_effort=\"${a#--effort=}\"")
      PREV_T="$a"; continue ;;
  esac
  ARGS_TRADUZIDOS+=("$a")
  PREV_T="$a"
done
if [ "${#ARGS_TRADUZIDOS[@]}" -gt 0 ]; then set -- "${ARGS_TRADUZIDOS[@]}"; fi

MODELO=""
EFFORT=""
MODELO_EXPLICITO=0
EFFORT_EXPLICITO=0
ULTIMO_ARG=""
PREV=""
for a in "$@"; do
  if [ "$PREV" = "-m" ] || [ "$PREV" = "--model" ]; then MODELO="$a"; MODELO_EXPLICITO=1; fi
  case "$a" in
    *model_reasoning_effort=*) EFFORT="${a#*model_reasoning_effort=}"; EFFORT="${EFFORT//\"/}"; EFFORT_EXPLICITO=1 ;;
  esac
  PREV="$a"
  ULTIMO_ARG="$a"
done

# O default do construtor vem do registro versionado; o chamador pode manter
# modelo/effort explícitos para uma escalada ou fallback já decidido.
LEDGER_PAPEL="${LEDGER_PAPEL:-construtor}"
case "$LEDGER_PAPEL" in
  construtor|revisor) ;;
  *)
    echo "run.sh: LEDGER_PAPEL inválido ('$LEDGER_PAPEL') — use construtor|revisor." >&2
    exit 3
    ;;
esac
[ -n "${LEDGER_TERRENO:-}" ] || { echo 'run.sh: LEDGER_TERRENO obrigatório.' >&2; exit 3; }
TERRENO_ROTA="$LEDGER_TERRENO"
RUNTIME_DIR="${HARNESS_RUNTIME_DIR:-$HOME/.claude/orquestracao}"
ROTA_SCRIPT="$RUNTIME_DIR/rota-harness.mjs"
DEFAULTS_FILE="${HARNESS_DEFAULTS_FILE:-$RUNTIME_DIR/defaults-terreno.json}"
ROTA_JSON=""
if ! command -v node >/dev/null 2>&1 || [ ! -f "$ROTA_SCRIPT" ] || [ ! -f "$DEFAULTS_FILE" ]; then
  echo "run.sh: BLOQUEADO — resolver de rota/defaults indisponível no staging." >&2
  exit 3
fi
ROTA_ARGS=(resolver --frente "${HARNESS_FRENTE:-codex}" --terreno "$TERRENO_ROTA" --papel "$LEDGER_PAPEL" --defaults "$DEFAULTS_FILE")
[ -n "$MODELO" ] && ROTA_ARGS+=(--modelo "$MODELO")
[ -n "$EFFORT" ] && ROTA_ARGS+=(--effort "$EFFORT")
[ -n "${LEDGER_MODELO_AUTOR:-}" ] && ROTA_ARGS+=(--modelo-autor "$LEDGER_MODELO_AUTOR")
[ "${LEDGER_REVISAO_FALLBACK_PROPRIO:-0}" = "1" ] && ROTA_ARGS+=(--fallback-proprio true)
[ -n "${LEDGER_FALLBACK_MOTIVO:-}" ] && ROTA_ARGS+=(--fallback-motivo "$LEDGER_FALLBACK_MOTIVO")
[ -n "${ROTEAMENTO_OK:-}" ] && ROTA_ARGS+=(--roteamento-ok "$ROTEAMENTO_OK")
[ -n "${HARNESS_RANDOM:-}" ] && ROTA_ARGS+=(--random "$HARNESS_RANDOM")
ROTA_JSON="$(node "$ROTA_SCRIPT" "${ROTA_ARGS[@]}")" || {
  echo "run.sh: BLOQUEADO — rota não resolvida; nenhum modelo foi executado." >&2
  exit 3
}
rota_campo() {
  ROTA_JSON="$ROTA_JSON" node -e 'const r=JSON.parse(process.env.ROTA_JSON); process.stdout.write(String(r[process.argv[1]] ?? ""));' "$1"
}
MODELO_CLI="$(rota_campo modelo_cli)"
MODELO_LOG="$(rota_campo modelo_log)"
EFFORT="$(rota_campo effort)"
ROTA_EXPERIMENTO_ID="$(rota_campo experiment_id)"
ROTA_ARM="$(rota_campo arm)"
ROTA_EXPERIMENT_VERSION="$(rota_campo experiment_version)"
ROTA_CONFIG_VERSION="$(rota_campo config_version)"
ROTA_ORIGEM="$(rota_campo rota_origem)"
ROTA_FALLBACK_MOTIVO="$(rota_campo fallback_motivo)"
ROTA_OK="$(rota_campo roteamento_ok)"
ROTA_MODELO_AUTOR="$(rota_campo modelo_autor)"
[ -n "$MODELO_CLI" ] || { echo "run.sh: BLOQUEADO — resolver retornou modelo CLI vazio." >&2; exit 3; }
MODELO="${MODELO_CLI}"

# Replace explicit stale choices as well: defaults must reach the CLI.
# Conscious escalations use the recorded fallback reason or ROTEAMENTO_OK.
ARGS_RESOLVIDOS=()
SKIP_NEXT=0
JSON_EXPLICITO=0
args_in=("$@")
for ((i=0; i<${#args_in[@]}; i++)); do
  a="${args_in[$i]}"
  if [ "$SKIP_NEXT" = 1 ]; then SKIP_NEXT=0; continue; fi
  case "$a" in
    -m|--model) SKIP_NEXT=1; continue ;;
    --model=*) continue ;;
    -c|--config)
      next="${args_in[$((i+1))]:-}"
      case "$next" in model_reasoning_effort=*) SKIP_NEXT=1; continue ;; esac ;;
    --config=model_reasoning_effort=*) continue ;;
    --json) JSON_EXPLICITO=1; continue ;;
  esac
  ARGS_RESOLVIDOS+=("$a")
done
set -- -m "$MODELO_CLI" -c "model_reasoning_effort=\"$EFFORT\"" --json "${ARGS_RESOLVIDOS[@]}"

# SANEAMENTO DO EFFORT (26/08/2026) — em 23-24/08 três despachos do fallback do
# cérebro passaram o MANUAL inteiro colado no argumento, e os 4.720 caracteres
# viraram o valor de `effort` no ledger: cada linha virou um "degrau" fantasma
# que despejava ~110 linhas de markdown no report. Corta no primeiro espaço e
# só deixa passar effort que EXISTE — o resto vira vazio (linha sem effort é
# ruim; linha com um manual dentro contamina a tabela e o motor de tier).
EFFORT="${EFFORT%%[[:space:]]*}"
case "$EFFORT" in
  low|medium|high|xhigh|max|'') ;;
  *)
    echo "⚠ run.sh: effort '${EFFORT:0:30}' não existe — a linha do ledger vai SEM effort. Use low|medium|high|xhigh|max." >&2
    EFFORT=""
    ;;
esac

# MODELO SEM EFFORT É ROTA INCOMPLETA (27/08/2026). O CLI pode assumir um
# default silencioso diferente do benchmark que escolheu o modelo; isso tornou
# impossível saber se uma falha veio do modelo ou do degrau. Todo despacho
# Codex agora declara o par, inclusive revisão e fallback.
if [ -z "$EFFORT" ]; then
  cat >&2 <<'FIM'
run.sh: BLOQUEADO — modelo sem effort explícito.
Sempre despache o par completo, por exemplo:
  -m gpt-5.6-luna -c model_reasoning_effort="max"
  -m gpt-5.6-sol  -c model_reasoning_effort="high"
O benchmark G4 escolhe MODELO; effort vem da calibração separada do harness.
FIM
  exit 3
fi

# Escape usado viaja para a nota do ledger: exceção invisível vira norma em duas
# semanas, e aí o bloqueio existe no papel e não nos números.
NOTA_EXCECAO=""

# PAPEL DO DESPACHO (26/08/2026) — construtor (escreve) ou revisor (julga).
# Sem esta marca o ledger não distingue "o worker errou" de "o revisor reprovou":
# em 7 d, 68 de 114 linhas eram revisão e 24 delas viraram `retrabalho`, o que
# derrubou `sol × sql` para ok1 15% e `sol × ui` para 0% — degraus que estavam
# funcionando. Default construtor: quem revisa sabe que revisa e carimba.
LEDGER_PAPEL="${LEDGER_PAPEL:-construtor}"
case "$LEDGER_PAPEL" in
  construtor|revisor) ;;
  *)
    echo "run.sh: LEDGER_PAPEL inválido ('$LEDGER_PAPEL') — use construtor|revisor." >&2
    exit 3
    ;;
esac

# REVISÃO CRUZADA REAL: outro harness revisa primeiro. A própria LLM só pode
# entrar quando o dispatcher comprovou indisponibilidade do outro harness.
# Bash 3.2 + `set -u` trata array vazio como variável inexistente. Mantemos um
# valor neutro para construtor; o ledger ignora modelo_autor fora de revisão.
MODELO_AUTOR_ARGS=(--modelo-autor nao-aplicavel)
if [ "$LEDGER_PAPEL" = "revisor" ]; then
  if [ -z "${LEDGER_MODELO_AUTOR:-}" ]; then
    echo "run.sh: BLOQUEADO — revisão exige LEDGER_MODELO_AUTOR=<modelo que construiu>." >&2
    exit 3
  fi
  if ! command -v node >/dev/null 2>&1 || [ ! -f "$HOME/.claude/orquestracao/ledger.mjs" ]; then
    echo "run.sh: BLOQUEADO — não foi possível provar a revisão por modelo diferente (ledger indisponível)." >&2
    exit 3
  fi
  if [ "${LEDGER_REVISAO_FALLBACK_PROPRIO:-0}" = "1" ]; then
    case "${LEDGER_FALLBACK_MOTIVO:-}" in
      outro_harness_indisponivel|outro_harness_saida_invalida) ;;
      *)
        echo "run.sh: BLOQUEADO — fallback próprio exige causa comprovada do outro harness." >&2
        exit 3
        ;;
    esac
    if ! node "$HOME/.claude/orquestracao/ledger.mjs" validar-revisao \
        --papel revisor --modelo "$MODELO_LOG" --modelo-autor "${ROTA_MODELO_AUTOR:-$LEDGER_MODELO_AUTOR}" \
        --fallback-proprio true >&2; then
      exit 3
    fi
    MODELO_AUTOR_ARGS=(--modelo-autor "$LEDGER_MODELO_AUTOR" --fallback-proprio true)
    NOTA_EXCECAO=" fallback proprio: outro harness indisponivel"
  else
    if ! node "$HOME/.claude/orquestracao/ledger.mjs" validar-revisao \
        --papel revisor --modelo "$MODELO_LOG" --modelo-autor "${ROTA_MODELO_AUTOR:-$LEDGER_MODELO_AUTOR}" >&2; then
      exit 3
    fi
    MODELO_AUTOR_ARGS=(--modelo-autor "$LEDGER_MODELO_AUTOR")
  fi
fi

# Risk and routing guards are centralized in rota-harness.mjs.
# Provider changes cannot be sent to the Codex binary accidentally.
ROTA_PROVEDOR="$(rota_campo provider)"
if [ "$ROTA_PROVEDOR" != codex ]; then
  echo "run.sh: fallback disponível $MODELO_CLI/$EFFORT no provedor $ROTA_PROVEDOR; use despachar-harness.mjs para executar a troca." >&2
  exit 5
fi


# DISJUNTOR DE REPETIÇÃO (25/08/2026) — a MESMA tarefa disparada em loop.
# Medido: entre 23/08 22:46 e 24/08 23:26, o cérebro dos loops caiu no Codex e
# despachou 961 vezes em 25 h — 768 delas `cerebro-entrevistador`, ~40 por hora,
# sem parar. O maestro reativo acorda de 15 em 15 min e reabre os MESMOS itens;
# nada no caminho sabia que aquilo já tinha rodado. Nenhum teto existente pegou:
# o cão de guarda mede UM despacho, o orçamento da nightly só vale de madrugada,
# e o ledger só registra depois do estrago.
#
# Só vale quando LEDGER_TAREFA é explícito — é o caso de lançador automático,
# que é exatamente quem entra em loop. Despacho escrito à mão pelo cérebro não
# repete rótulo e não é julgado aqui. Fail-open: sem node, sem ledger ou com
# qualquer erro de leitura, o despacho passa — teto que derruba trabalho bom
# custa mais caro que a repetição que ele evita.
if [ -n "${LEDGER_TAREFA:-}" ] && [ -z "${DESPACHO_REPETIDO_OK:-}" ] &&
  command -v node >/dev/null 2>&1; then
  REPET_MAX="${DESPACHO_REPETIDO_MAX:-12}"
  case "$REPET_MAX" in ''|*[!0-9]*) REPET_MAX=12 ;; esac
  REPET_N="$(LEDGER_TAREFA="$LEDGER_TAREFA" node -e '
    const fs = require("fs"), os = require("os"), path = require("path");
    const dir = path.join(os.homedir(), ".claude", "orquestracao");
    const alvo = process.env.LEDGER_TAREFA || "";
    const corte = Date.now() - 3600e3;
    let n = 0;
    for (const f of ["ledger.jsonl", "ledger-cerebro-fallback.jsonl"]) {
      let txt; try { txt = fs.readFileSync(path.join(dir, f), "utf8"); } catch { continue; }
      for (const l of txt.split("\n")) {
        if (!l || l[0] !== "{") continue;
        let o; try { o = JSON.parse(l); } catch { continue; }
        if (o.tarefa === alvo && Date.parse(o.ts || "") >= corte) n++;
      }
    }
    process.stdout.write(String(n));
  ' 2>/dev/null || true)"
  case "$REPET_N" in ''|*[!0-9]*) REPET_N=0 ;; esac
  if [ "$REPET_N" -ge "$REPET_MAX" ]; then
    echo "run.sh: BLOQUEADO — a tarefa \"$LEDGER_TAREFA\" já foi despachada ${REPET_N}x na última hora (teto ${REPET_MAX})." >&2
    echo "Isso é lançador em loop, não trabalho: em 24/08 o mesmo padrão gerou 961 despachos em 25 h." >&2
    echo "Conserte o lançador. Se a repetição for mesmo intencional: DESPACHO_REPETIDO_OK=1 ... run.sh ..." >&2
    echo "Para afrouxar o teto: DESPACHO_REPETIDO_MAX=<n> ... run.sh ..." >&2
    exit 3
  fi
fi

# DESPACHO VAZIO (17/08/2026) — o ledger tem uma linha cuja tarefa era o texto
# `true`: um despacho disparado por engano, que virou registro de entrega e
# entrou no denominador dos KPIs até ser reclassificado à mão. Prompt curto
# demais não é tarefa; é dedo no gatilho. Só vale quando o último argumento é
# mesmo o prompt (não é flag, e não há `-` pedindo prompt pelo stdin).
PROMPT_PELO_STDIN=0
for a in "$@"; do
  case "$a" in -) PROMPT_PELO_STDIN=1 ;; esac
done
if [ "$PROMPT_PELO_STDIN" = 0 ] && [ -z "${DESPACHO_CURTO_OK:-}" ]; then
  case "$ULTIMO_ARG" in
    -*) ;; # último argumento é flag: o prompt veio noutro lugar, não julgue
    *)
      if [ "${#ULTIMO_ARG}" -lt 20 ]; then
        echo "run.sh: BLOQUEADO — prompt com ${#ULTIMO_ARG} caracteres não é enunciado de tarefa." >&2
        echo "Worker nasce cego: descreva objetivo, critério de aceite e fronteiras." >&2
        echo "Se for mesmo intencional: DESPACHO_CURTO_OK=1 ... run.sh ..." >&2
        exit 3
      fi
      ;;
  esac
fi

# CONTEXTO DA FRENTE (17/08/2026) — worker externo nasce cego e não tem
# /compact: sem um resumo âncora, cada despacho da MESMA frente reabre decisão
# já fechada. O estado vive em ~/.claude/orquestracao/contexto.mjs (o porquê e a
# evidência estão no cabeçalho de lá) e é FUNDIDO ao longo da frente, nunca
# regerado. Aqui só se injeta o bloco no topo do prompt.
#
# Só mexe no ÚLTIMO argumento, e só quando ele é mesmo o prompt — a mesma
# heurística que o registro do ledger já usa. Render vazio, node ausente ou CTX
# apontando para frente inexistente seguem SEM contexto: um resumo que falta
# custa menos que um despacho que não acontece.
if [ -n "${CTX:-}" ] && [ "$PROMPT_PELO_STDIN" = 0 ] && command -v node >/dev/null 2>&1 &&
  [ -f "$HOME/.claude/orquestracao/contexto.mjs" ]; then
  case "$ULTIMO_ARG" in
    -*) echo "⚠ run.sh: CTX ignorado — o último argumento é uma flag, não o prompt." >&2 ;;
    *)
      BLOCO_CTX="$(node "$HOME/.claude/orquestracao/contexto.mjs" render "$CTX" 2>/dev/null || true)"
      if [ -n "$BLOCO_CTX" ]; then
        ARGS_CTX=()
        TOTAL=$#
        IDX=0
        for a in "$@"; do
          IDX=$((IDX + 1))
          if [ "$IDX" -eq "$TOTAL" ]; then
            ARGS_CTX+=("$BLOCO_CTX
$a")
          else
            ARGS_CTX+=("$a")
          fi
        done
        set -- "${ARGS_CTX[@]}"
        echo "run.sh: contexto da frente \"$CTX\" injetado no prompt." >&2
      else
        echo "⚠ run.sh: CTX=\"$CTX\" não existe em orquestracao/contextos — seguindo SEM contexto." >&2
      fi
      ;;
  esac
fi

# PONTE DE CONSTRUÇÃO CODEX → CLAUDE (2026-08-31) — terrenos ui/analise têm
# titular GERAL num modelo Claude (Fable/Opus) que este Codex não invoca
# nativamente (ver spec
# docs/superpowers/specs/2026-08-31-ponte-construcao-codex-claude-design.md).
# Ligada por default desde 31/08 (dono, pós-merge do PR #1799) — a primeira
# prova ao vivo de `--model fable`/`--model opus` ainda não rodou; o
# fallback abaixo cai no Sol nativo se a ponte falhar/indisponível, então o
# risco fica contido. Reversão: `CODEX_CONSTRUCAO_CROSS_HARNESS=0`.
# Só tenta para CONSTRUÇÃO (papel construtor) — revisão continua no
# revisao-multillm.mjs existente.
#
# Posição (corrigida 31/08): DEPOIS do disjuntor de repetição, do guard de
# despacho vazio e da injeção de CONTEXTO DA FRENTE. A ponte gasta quota
# Anthropic de verdade, então passa pelos MESMOS freios do caminho nativo — e
# usa `"${@: -1}"` (o último argumento ATUAL) para receber o prompt já
# enriquecido pelo CTX, igual ao `codex exec "$@"` lá embaixo.
if [ "${CODEX_CONSTRUCAO_CROSS_HARNESS:-1}" = "1" ] \
   && { [ "${LEDGER_TERRENO:-}" = "ui" ] || [ "${LEDGER_TERRENO:-}" = "analise" ]; } \
   && [ "${LEDGER_PAPEL:-construtor}" = "construtor" ] \
   && [ "$PROMPT_PELO_STDIN" = 0 ]; then
  PROMPT_PONTE="${@: -1}"
  case "$PROMPT_PONTE" in
    -*) ;; # último argumento é flag: o prompt veio noutro lugar — segue nativo
    *)
      PONTE="scripts/loops/construcao-multillm.mjs"
      if [ -f "$PONTE" ] && command -v node >/dev/null 2>&1; then
        echo "run.sh: tentando a ponte de construção Codex→Claude (${LEDGER_TERRENO})..." >&2
        if node "$PONTE" --terreno "$LEDGER_TERRENO" -- "$PROMPT_PONTE" 2>&2; then
          echo "run.sh: ponte de construção concluiu — revise o diff antes de fechar." >&2
          exit 0
        fi
        echo "run.sh: ponte de construção falhou/indisponível — caindo no titular nativo (Sol)." >&2
      else
        echo "run.sh: ponte de construção pedida, mas $PONTE não existe neste checkout — seguindo no Sol nativo (worktree pode estar desatualizado)." >&2
      fi
      ;;
  esac
fi

# Só depois de saber que o despacho vai mesmo acontecer — o carimbo é consumido
# na leitura e não deve ser gasto por uma chamada que aborta antes de começar.
PREPARO="$(preparo_min || true)"

# Correlação sem conteúdo: hooks de subagente herdam este id e o ledger
# anexa ao registro-pai somente contagem/perfil/modelo. O pid evita colisão
# entre despachos iniciados no mesmo segundo.
HARNESS_RUN_ID="h$(date +%s)-$$"
export HARNESS_RUN_ID

# stdout flui ao vivo (tee); stderr vai pra arquivo e é repassado ao fim —
# os dois são vasculhados pelos detectores literais de quota.
# GATE DE RECURSOS (26/08/2026) — não deixar nascer despacho AUTOMÁTICO com a
# máquina em colapso. Medido no ledger: os 4 `rc=137` de 23-24/08 são SIGKILL
# vindo de fora, e os dois piores caíram com load 83.8 num Mac de 8 cores
# (swap 78%) — 10x o overcommit. Um despacho que nasce nesse estado é morto
# antes de produzir nada: gasta quota, suja o ledger e ainda piora a fila.
#
# Três limites de propósito:
#  · só vale para lançador AUTOMÁTICO (LEDGER_TAREFA setado) — despacho
#    escrito à mão pelo cérebro ou pelo dono NUNCA é barrado aqui;
#  · o limiar é `vermelho` do vigia (swap>95% OU load>4x cores, SUSTENTADO),
#    não `amarelo`: amarelo é o estado normal desta máquina (load mediano
#    19.2 contra o gatilho de 16), e barrar nele pararia a esteira inteira;
#  · fail-open em tudo — sem vigia, sem node, estado velho (>10 min) ou
#    qualquer erro de leitura, o despacho PASSA. Teto que derruba trabalho
#    bom custa mais caro que o despacho perdido que ele evitaria.
# Escape consciente: RECURSOS_OK=1.
if [ -n "${LEDGER_TAREFA:-}" ] && [ -z "${RECURSOS_OK:-}" ] && command -v node >/dev/null 2>&1; then
  EST_VIGIA="$HOME/.claude/orquestracao/vigia-estado.json"
  if [ -f "$EST_VIGIA" ]; then
    VEREDICTO_REC="$(node -e '
      try {
        const e = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
        const idade = Date.now() - Number(e.atualizado_em || 0);
        // Estado velho não vale como prova: a máquina pode ter aliviado.
        if (e.estado === "vermelho" && idade >= 0 && idade < 10 * 60 * 1000) {
          console.log("barra " + Math.round(idade / 1000));
        } else console.log("passa");
      } catch { console.log("passa"); }
    ' "$EST_VIGIA" 2>/dev/null || echo passa)"
    case "$VEREDICTO_REC" in
      barra*)
        echo "run.sh: BARRADO pelo gate de recursos — a máquina está VERMELHA (vigia: swap>95% ou load>4x cores, sustentado)." >&2
        echo "  Despacho automático não nasce nesse estado: seria morto antes de produzir nada (foi o que houve nos rc=137 de 23-24/08)." >&2
        echo "  O lançador tenta de novo no próximo ciclo. Para forçar agora: RECURSOS_OK=1 <o mesmo comando>" >&2
        if [ "${LEDGER_OFF:-0}" != "1" ] && [ -f "$HOME/.claude/orquestracao/ledger.mjs" ]; then
          node "$HOME/.claude/orquestracao/ledger.mjs" log --frente codex \
            --modelo "$MODELO" ${EFFORT:+--effort "$EFFORT"} \
            "${MODELO_AUTOR_ARGS[@]}" \
            --terreno "${LEDGER_TERRENO:-rotina}" --papel "${LEDGER_PAPEL:-construtor}" \
            --resultado infra --tarefa "$LEDGER_TAREFA" \
            --nota "gate de recursos: nao despachado CAUSA=maquina-vermelha" --auto >&2 || true
        fi
        exit 4
        ;;
    esac
  fi
fi

TMP_OUT="$(mktemp)"
TMP_ERR="$(mktemp)"
TMP_PID="$(mktemp)"
TMP_RC="$(mktemp)"
TMP_TIMEOUT="$(mktemp)"
# Marca de tempo para achar o rollout do Codex que ESTE despacho cria (ponte
# tokens↔effort, 2026-09-10): o `codex exec` grava um .jsonl novo em
# ~/.codex/sessions a cada chamada; o mais recente `-newer` esta marca,
# criada agora, é o desta execução.
MARCA_SESSAO="$(mktemp)"
trap 'rm -f "$TMP_OUT" "$TMP_ERR" "$TMP_PID" "$TMP_RC" "$TMP_TIMEOUT" "$MARCA_SESSAO"' EXIT
INICIO=$SECONDS

# STDIN FECHADO — a causa do despacho que fica pendurado para sempre.
# O `codex exec` LÊ stdin sempre que ele não é um terminal, MESMO com o prompt
# já dado em argv: o help do codex-cli 0.145.0 diz "If stdin is piped and a
# prompt is also provided, stdin is appended as a <stdin> block". Despacho
# lançado em background pelo harness herda um pipe que nunca recebe EOF, então
# o processo bloqueia no read() ANTES de qualquer validação e fica vivo com ~0%
# de CPU, stderr parado em "Reading additional input from stdin...".
# Foi o que se viu em 13/08/2026: três processos pendurados ao mesmo tempo, um
# deles por ~6 h. Reproduzido em bancada (15/08/2026):
#   ( sleep 120 | codex exec -m modelo-invalido "diga OK" ) &   → passa de 40 min
#   o MESMO comando com </dev/null                              → morre em 25 s
# Não existe flag no CLI para desligar essa leitura; fechar o descritor é o
# conserto. `-` é o pedido EXPLÍCITO de ler o prompt do stdin — nesse caso o
# stdin original é preservado, senão o conserto quebraria o uso legítimo.
STDIN_EXPLICITO=0
for a in "$@"; do
  case "$a" in -) STDIN_EXPLICITO=1 ;; esac
done
if [ "$STDIN_EXPLICITO" = 1 ]; then exec 3<&0; else exec 3</dev/null; fi

# CÃO DE GUARDA — rede de segurança independente da causa acima. Existe para
# que NENHUM travamento futuro (outra causa, outra versão do CLI) deixe o
# processo pendurado e a linha "pendente" órfã no ledger. O teto é generoso de
# propósito: tarefa longa é normal aqui, e matar despacho saudável custa mais
# caro que esperar demais. CODEX_TIMEOUT_MIN=0 desliga.
LIMITE_MIN="${CODEX_TIMEOUT_MIN:-90}"
case "$LIMITE_MIN" in ''|*[!0-9]*) LIMITE_MIN=90 ;; esac

CAO=""
if [ "$LIMITE_MIN" -gt 0 ]; then
  (
    # O pid aparece assim que o codex nasce; sem ele em 60 s não há o que vigiar.
    esperou=0
    while [ ! -s "$TMP_PID" ] && [ "$esperou" -lt 60 ]; do sleep 1; esperou=$((esperou + 1)); done
    cpid="$(cat "$TMP_PID" 2>/dev/null || true)"
    case "$cpid" in ''|*[!0-9]*) exit 0 ;; esac
    restante=$(( LIMITE_MIN * 60 ))
    while [ "$restante" -gt 0 ] && kill -0 "$cpid" 2>/dev/null; do
      sleep 15
      restante=$(( restante - 15 ))
    done
    kill -0 "$cpid" 2>/dev/null || exit 0
    printf 'timeout' >"$TMP_TIMEOUT"
    # Mata o GRUPO (`-pid`), não só o processo. Medido em bancada: matando só o
    # pid, um neto sobrevivente continua segurando a ponta do pipe e o `tee`
    # nunca vê EOF — o run.sh fica pendurado do mesmo jeito, que é exatamente o
    # que este cão existe para impedir. O `set -m` do outro lado faz o codex
    # nascer líder do próprio grupo; o fallback cobre o caso de não ser.
    kill -TERM -"$cpid" 2>/dev/null || kill -TERM "$cpid" 2>/dev/null || true
    sleep 10
    kill -KILL -"$cpid" 2>/dev/null || kill -KILL "$cpid" 2>/dev/null || true
  ) &
  CAO=$!
  # Sem o disown, matar o cão no fim faz o bash imprimir "Terminated: 15" com o
  # corpo inteiro do subshell no stderr do despacho — ruído que parece erro.
  disown "$CAO" 2>/dev/null || true
fi

set +e
# O rc do codex viaja por arquivo, não por PIPESTATUS: com o processo em
# background (para o cão de guarda ter um pid), PIPESTATUS[0] passaria a ser o
# do bloco, não o do codex — e todo despacho sairia com rc=0.
# `set -m` faz o codex nascer em process group PRÓPRIO, para o cão de guarda
# poder matar a árvore inteira de uma vez (ver acima). Volta a sair logo depois.
{ set -m; "${HARNESS_CODEX_BIN:-codex}" exec "$@" <&3 2>"$TMP_ERR" & echo $! >"$TMP_PID"; set +m; wait $!; echo $? >"$TMP_RC"; } | tee "$TMP_OUT" | node "$RUNTIME_DIR/codex-eventos.mjs" mostrar "$JSON_EXPLICITO"
RC="$(cat "$TMP_RC" 2>/dev/null || true)"
case "$RC" in ''|*[!0-9]*) RC=1 ;; esac
set -e
[ -n "$CAO" ] && kill "$CAO" 2>/dev/null || true
cat "$TMP_ERR" >&2
DUR_SEG=$(( SECONDS - INICIO ))
DUR_MIN=$(( (DUR_SEG + 30) / 60 ))
if [ -s "$TMP_TIMEOUT" ]; then
  echo "run.sh: despacho morto pelo cão de guarda após ${LIMITE_MIN} min (CODEX_TIMEOUT_MIN)." >&2
fi

# Registro automático no ledger — nunca derruba o worker (|| true).
LEDGER="$RUNTIME_DIR/ledger.mjs"
if [ "${LEDGER_OFF:-0}" != "1" ] && command -v node >/dev/null 2>&1 && [ -f "$LEDGER" ]; then
  RESULTADO="pendente"
  # SINAIS DE INVOCAÇÃO (26/08/2026) — calculados UMA vez, porque a nota do
  # ledger precisa dizer QUAL das três coisas aconteceu, e não só "infra".
  # · invocação quebrada: o CLI recusou os argumentos e nada rodou;
  # · morto de fora: 128+sinal sem o cão de guarda ter disparado — ambiente
  #   (kernel sob pressão, pkill de limpeza, launchd), não o lançador. Medido
  #   em 23-24/08/2026: os 4 rc=137 caíram com load 84 e 20 num Mac de 8 cores
  #   e swap 78%/55% — a máquina em colapso, não o script;
  # · nunca produziu saída: morreu cedo E não escreveu nada em stdout.
  INVOC_QUEBRADA=0
  grep -qiE "Reading additional input from stdin|skip-git-repo-check|not (inside|a) .*git repo|error: unexpected argument|unrecognized (option|subcommand)|error: invalid value" "$TMP_ERR" "$TMP_OUT" && INVOC_QUEBRADA=1
  MORTO_DE_FORA=0
  if [ ! -s "$TMP_TIMEOUT" ]; then
    case "$RC" in 130|137|143) MORTO_DE_FORA=1 ;; esac
  fi
  # Quota EXIGE saída não-zero: o codex aborta quando bate o limite. Sem esse
  # gate, o detector casava com o texto do PRÓPRIO CLAUDE.md ecoado no stdout
  # (a seção que documenta as frases literais de quota) e marcava "quota" em
  # despacho que terminou com rc=0 — 4 falsos positivos em 10/08/2026, que
  # entram direto no KPI de saturação usado para decidir assinatura.
  if [ "$RC" -ne 0 ] && \
     grep -qiE "hit your usage limit|5-hour message limit" "$TMP_ERR" "$TMP_OUT"; then
    RESULTADO="quota"
  # O worker NUNCA RODOU: crash de invocação, flag errada, processo travado
  # antes de começar. Isso é bug do LANÇADOR, não qualidade do modelo — medido
  # em 14/08/2026: 8 dos 9 `falhou` de 14 dias eram isto, e 7 caíram no balde
  # `rotina`, fabricando o falso sinal "Sol/high em rotina 31%".
  # Dois detectores, mesmo formato do de quota (exige saída não-zero):
  #   · morreu em ~0 min — não deu tempo de nada acontecer;
  #   · texto literal de invocação quebrada (o rc=143 que travou 51 min em
  #     "Reading additional input from stdin" nunca chegou a rodar).
  elif [ "$RC" -ne 0 ] && { [ "$INVOC_QUEBRADA" -eq 1 ] || [ "$MORTO_DE_FORA" -eq 1 ] || \
       { [ "$DUR_SEG" -lt 30 ] && [ ! -s "$TMP_OUT" ]; }; }; then
    RESULTADO="infra"
  # Morto pelo cão de guarda e SEM sinal de invocação quebrada acima: o worker
  # rodou de verdade e não terminou dentro do teto. Fica "falhou" em vez de
  # "pendente", que ninguém fecharia. A nota diz o que houve.
  elif [ -s "$TMP_TIMEOUT" ]; then
    RESULTADO="falhou"
  fi
  NOTA_TIMEOUT=""
  if [ -s "$TMP_TIMEOUT" ]; then
    NOTA_TIMEOUT=" TIMEOUT: morto pelo cão de guarda em ${LIMITE_MIN}min (CODEX_TIMEOUT_MIN)"
  fi
  # CAUSA do infra na própria nota (26/08/2026). Antes, todo `infra` saía com
  # a mesma cara ("rc=X exec=0min") e o report mandava "conserte o run.sh" —
  # mesmo quando o script estava intacto e quem matou o processo foi a
  # máquina. Sem a causa, o alarme aponta para o lugar errado e o conserto
  # real nunca acontece.
  NOTA_CAUSA=""
  if [ "$RESULTADO" = "infra" ]; then
    if [ "$MORTO_DE_FORA" -eq 1 ]; then
      # Carga no instante da morte: é ela que distingue "máquina em colapso"
      # de "alguém deu pkill". Fail-open — sem vigia, a nota sai sem o trecho.
      CARGA=""
      VIGIA="$HOME/.claude/orquestracao/vigia-recursos.jsonl"
      if [ -f "$VIGIA" ]; then
        CARGA="$(tail -n 400 "$VIGIA" 2>/dev/null | grep '"evento":"rodada"' | tail -1 \
          | sed -n 's/.*"estado":"\([a-z]*\)".*"swapPct":\([0-9.]*\).*"load1":\([0-9.]*\).*/ maquina=\1 load=\3 swap=\2/p' 2>/dev/null)" || CARGA=""
      fi
      NOTA_CAUSA=" CAUSA=morto-de-fora(sinal $((RC - 128)))${CARGA}"
    elif [ "$INVOC_QUEBRADA" -eq 1 ]; then
      NOTA_CAUSA=" CAUSA=invocacao-quebrada"
    else
      NOTA_CAUSA=" CAUSA=nunca-produziu-saida(${DUR_SEG}s)"
    fi
  fi
  RECIBO="$(node "$RUNTIME_DIR/codex-eventos.mjs" recibo "$TMP_OUT")"
  SESSION_ID="$(RECIBO="$RECIBO" node -e 'process.stdout.write(JSON.parse(process.env.RECIBO).session_id || "")')"
  TOKENS="$(RECIBO="$RECIBO" node -e 'const v=JSON.parse(process.env.RECIBO).tokens;process.stdout.write(v==null?"":String(v))')"
  EXPERIMENTO_ARGS=(--config-version "$ROTA_CONFIG_VERSION" --rota-origem "$ROTA_ORIGEM")
  if [ -n "$ROTA_EXPERIMENTO_ID" ]; then
    EXPERIMENTO_ARGS+=(--experiment-id "$ROTA_EXPERIMENTO_ID" --arm "$ROTA_ARM" --experiment-version "$ROTA_EXPERIMENT_VERSION")
  fi
  [ -z "$TOKENS" ] || EXPERIMENTO_ARGS+=(--tokens "$TOKENS")
  CONFIRMADO="$(node "$RUNTIME_DIR/codex-eventos.mjs" confirmar "${CODEX_HOME:-$HOME/.codex}/sessions" "$SESSION_ID" "$MODELO_CLI" "$EFFORT")"
  EXPERIMENTO_ARGS+=(--modelo-confirmado "$CONFIRMADO")
  TAREFA="${LEDGER_TAREFA:-${ULTIMO_ARG:0:80}}"
  # Terreno OMITIDO ≠ terreno "rotina". Sem esta marca o balde `rotina` acumula
  # todo despacho que o cérebro esqueceu de classificar e passa a parecer um
  # degrau ruim: em 13/08/2026 o sinal "Sol/high em rotina, ok1 40%" era isso —
  # o balde default carregando tarefas de 96 e 99 min, mais longas que qualquer
  # tarefa marcada `dificil`. O report ignora baldes dominados por inferido.
  TERRENO="${LEDGER_TERRENO:-rotina}"
  INFERIDO=""
  if [ -z "${LEDGER_TERRENO:-}" ]; then
    INFERIDO="--terreno-inferido"
    # Omissão VISÍVEL: sem carimbo a linha entra como inferido/ambíguo e fica
    # FORA dos KPIs de tier (o motor auto-subir.mjs nunca a enxerga). O aviso
    # aparece no stderr do despacho pra o cérebro corrigir na próxima chamada.
    echo "⚠ LEDGER_TERRENO não setado — linha carimbada como inferido ('rotina') e FORA dos KPIs de tier. Sete LEDGER_TERRENO=ui|rotina|dificil|analise|mecanico|sql no próximo despacho." >&2
  fi
  node "$LEDGER" log --frente codex --modelo "$MODELO_LOG" "${EXPERIMENTO_ARGS[@]}" \
    ${EFFORT:+--effort "$EFFORT"} ${PREPARO:+--preparo "$PREPARO"} \
    "${MODELO_AUTOR_ARGS[@]}" \
    --run-id "$HARNESS_RUN_ID" ${SESSION_ID:+--session-id "$SESSION_ID"} \
    ${LEDGER_ORQUESTRACAO:+--orquestracao "$LEDGER_ORQUESTRACAO"} \
    ${LEDGER_SUBAGENTES_PLANEJADOS:+--subagentes-planejados "$LEDGER_SUBAGENTES_PLANEJADOS"} \
    --terreno "$TERRENO" $INFERIDO --papel "$LEDGER_PAPEL" --resultado "$RESULTADO" \
    --dur "$(awk -v s="$DUR_SEG" 'BEGIN{printf "%.3f", s/60}')" --tarefa "$TAREFA" --nota "auto run.sh rc=$RC exec=${DUR_MIN}min$NOTA_TIMEOUT$NOTA_CAUSA$NOTA_EXCECAO" --auto >&2 || true
fi

# Existing callers also receive the configured alternate provider after quota.
# The common dispatcher sets depth=1 to avoid nested retries.
if [ "${RESULTADO:-}" = quota ] && [ "${HARNESS_DISPATCH_DEPTH:-0}" = 0 ] && [ "$STDIN_EXPLICITO" = 0 ]; then
  PROMPT_FALLBACK="$(mktemp)"
  printf '%s' "$ULTIMO_ARG" > "$PROMPT_FALLBACK"
  set +e
  HARNESS_DISPATCH_DEPTH=1 node "$RUNTIME_DIR/despachar-harness.mjs" --frente "${HARNESS_FRENTE:-codex}" --terreno "$TERRENO_ROTA" --prompt-file "$PROMPT_FALLBACK" --fallback-motivo quota_openai
  RC=$?
  set -e
  rm -f "$PROMPT_FALLBACK"
fi
exit $RC
