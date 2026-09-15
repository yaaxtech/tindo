/**
 * Mapa canônico de nomes de modelo do harness.
 *
 * O ledger acumulou apelidos diferentes pro mesmo modelo (opus, opus-4.8,
 * claude-opus-4-8...), o que
 * fragmenta o n= dos KPIs e invalida os sinais do report. Este módulo é o
 * ÚNICO lugar que decide o nome canônico — usado na ENTRADA (ledger.mjs log)
 * e na LEITURA (report/painel/auditoria, para o histórico já gravado).
 *
 * Nunca reescrever o ledger.jsonl bruto: normalizar na leitura preserva o dado.
 */

// Separador tolerado entre nome e versão: hífen, underscore, ponto OU ESPAÇO.
// O espaço é essencial: os nomes de TELA do Claude chegam com espaço ("Opus 5",
// "Sonnet 5", "Fable 5.1") e, sem ele, escapavam intactos e fragmentavam o KPI.
const CANON = [
  [/^(kimi-code\/)?k3-256k$/i, 'k3-256k'],
  [/^kimi-code\/k3$/i, 'k3'],
  // Codex: apelidos crus e prefixo `codex/` colapsam no id oficial gpt-5.6-*.
  // Idempotente para o nome já canônico. Ancorado ao sufixo exato, então
  // gpt-5.6-codex / codex / codex-config-default / explorer passam intactos.
  [/^(codex\/)?(gpt-5\.6-)?sol$/i, 'gpt-5.6-sol'],
  [/^(codex\/)?(gpt-5\.6-)?terra$/i, 'gpt-5.6-terra'],
  [/^(codex\/)?(gpt-5\.6-)?luna$/i, 'gpt-5.6-luna'],
  [/^(codex\/)?(gpt-6-)?astra$/i, 'gpt-6-astra'],
  // Opus 4.8 — inclui o apelido antigo "opus" (todos os registros com "opus"
  // seco são anteriores a 2026-08-04, quando o Opus 5 entrou na cadeia)
  [/^(claude-)?opus([-_. ]?4[-_. ]?8)?$/i, 'opus-4.8'],
  [/^(claude-)?opus[-_. ]?5$/i, 'opus-5'],
  [/^(claude-)?fable[-_. ]?5[-_. ]?1$/i, 'fable-5.1'],
  // Família Claude sem versão fragmentada até agora — só tolera prefixo
  [/^(claude-)?fable([-_. ]?5)?$/i, 'fable'],
  [/^(claude-)?sonnet([-_. ]?5)?$/i, 'sonnet'],
  [/^(claude-)?haiku([-_. ]?4[-_. ]?5)?$/i, 'haiku'],
];

export function normModelo(m) {
  const s = String(m || '').trim();
  for (const [re, canon] of CANON) if (re.test(s)) return canon;
  return s; // gpt-5.6-sol/terra/luna e desconhecidos passam intactos
}

// Frente inferida pelo modelo canônico (usada pelo `ledger.mjs log-rapido`)
export function inferirFrente(modelo) {
  const m = normModelo(modelo);
  if (/^gpt-/.test(m)) return 'codex';
  if (/^(opus|sonnet|haiku|fable)/.test(m)) return 'claude';
  return null;
}
