#!/usr/bin/env node
import { existsSync, realpathSync } from 'node:fs';
/**
 * Seleção de braços experimentais para uma rota já resolvida.
 *
 * A função pública `sortear` preserva o formato antigo. O launcher usa
 * `sortearDetalhado` para levar modelo, experimento e braço ao ledger.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const DEFAULT_FILE = join(homedir(), '.claude', 'orquestracao', 'defaults-terreno.json');
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

function lerDefaults(file = DEFAULT_FILE) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function familia(modelo) {
  const m = String(modelo || '').toLowerCase();
  if (/astra|gpt-6-astra/.test(m)) return 'astra';
  if (/sol|gpt-5\.6-sol/.test(m)) return 'sol';
  if (/luna|gpt-5\.6-luna/.test(m)) return 'luna';
  if (/terra/.test(m)) return 'terra';
  if (/^(?:claude-)?opus[-_. ]?5$/.test(m)) return 'opus5';
  if (/^(?:claude-)?opus[-_. ]?4[-_. ]?8$/.test(m)) return 'opus4_8';
  if (/sonnet/.test(m)) return 'sonnet';
  if (/^(?:claude-)?fable[-_. ]?5[-_. ]?1$/.test(m)) return 'fable5_1';
  if (/fable/.test(m)) return 'fable';
  if (/haiku/.test(m)) return 'haiku';
  return m;
}

function validarExperimento(exp, terreno) {
  if (!exp || typeof exp !== 'object' || !exp.id || !Array.isArray(exp.bracos) || !exp.bracos.length) {
    throw new Error(`experimento ativo inválido em ${terreno}: exige id e bracos`);
  }
  if (new Set(exp.bracos.map(b=>b.id)).size!==exp.bracos.length) throw new Error('braços duplicados');
  let pesoTotal = 0;
  for (const b of exp.bracos) {
    if (!b || !b.id || !b.modelo || !EFFORTS.has(b.effort)) {
      throw new Error(`braço inválido no experimento ${exp.id}: exige id, modelo e effort válido`);
    }
    if (!Number.isFinite(Number(b.peso)) || Number(b.peso) < 0) {
      throw new Error(`peso inválido no braço ${b.id} do experimento ${exp.id}`);
    }
    pesoTotal += Number(b.peso);
  }
  if (pesoTotal <= 0) throw new Error(`experimento ${exp.id} não tem peso positivo`);
  return pesoTotal;
}

function parBase(terrenoCfg, defaults, base) {
  if (base?.modelo && base?.effort) return { modelo: familia(base.modelo), effort: base.effort };
  const modelo = terrenoCfg.modelo ||
    terrenoCfg.braco_experimental_xhigh?.modelo ||
    (terrenoCfg.effort_por_modelo?.astra ? 'astra' : null);
  const f = familia(modelo);
  const effort = terrenoCfg.effort_por_modelo?.[f] ||
    terrenoCfg.effort_por_modelo?.[modelo] || terrenoCfg.effort;
  return modelo && effort ? { modelo: f, effort } : null;
}

function baseExperimentArm(exp, current) {
  const byId = exp.base && exp.bracos.find((b) => b.id === exp.base);
  if (byId) return byId;
  return exp.bracos.find((b) => !current ||
    (familia(b.modelo) === current.modelo && b.effort === current.effort));
}

function escolherArm(exp, rnd) {
  const alvo = Math.max(0, Math.min(0.999999999999, Number(rnd())));
  const total = exp.bracos.reduce((s, b) => s + Number(b.peso), 0);
  let acumulado = 0;
  for (const b of exp.bracos) {
    acumulado += Number(b.peso) / total;
    if (alvo < acumulado) return b;
  }
  return exp.bracos[exp.bracos.length - 1];
}

/**
 * Sorteia um braço somente quando a configuração está ativa e seu braço-base
 * coincide com o modelo/effort corrente. A rota SQL nunca recebe experimento.
 */
export function sortearDetalhado(terreno, rnd = Math.random, defaults, base) {
  const cfg = defaults ?? lerDefaults();
  const terrenoCfg = cfg?.terrenos?.[terreno];
  if (!terrenoCfg) throw new Error(`terreno desconhecido em terrenos: ${terreno}`);
  const current = parBase(terrenoCfg, cfg, base);
  if (!current) throw new Error(`default incompleto em terrenos.${terreno}`);
  if (terreno === 'sql') return { arm: 'base', modelo: current.modelo, effort: current.effort };

  const exp = terrenoCfg.experimento;
  if (exp?.ativo === true) {
    validarExperimento(exp, terreno);
    const reference = baseExperimentArm(exp, current);
    if (!reference || (current && (familia(reference.modelo) !== current.modelo || reference.effort !== current.effort))) {
      return { arm: 'base', modelo: current.modelo, effort: current.effort };
    }
    const selected = escolherArm(exp, rnd);
    return {
      arm: selected.id,
      modelo: familia(selected.modelo),
      effort: selected.effort,
      experiment_id: exp.id,
    };
  }

  // Compatibilidade com o formato antigo. Ele só pode aparecer se o modelo
  // corrente for Astra; não transforma um braço planejado em execução em
  // rotina Sol/Luna.
  if (cfg._meta?.governanca === 'experimentos-v1') return {arm:'base',modelo:current.modelo,effort:current.effort};
  const legacy = terrenoCfg.braco_experimental_xhigh;
  if (legacy && familia(legacy.modelo) === 'astra' && current.modelo === 'astra' &&
      EFFORTS.has(legacy.effort) && Number.isFinite(Number(legacy.amostragem)) &&
      Number(legacy.amostragem) > 0 && Number(rnd()) < Number(legacy.amostragem)) {
    return {
      arm: 'xhigh_exp',
      modelo: 'astra',
      effort: legacy.effort,
      experiment_id: legacy.id || `legacy-${terreno}-braco-experimental-xhigh`,
    };
  }
  return { arm: 'base', modelo: current.modelo, effort: current.effort };
}

/** Backward-compatible two-field result used by existing callers/tests. */
export function sortear(terreno, rnd = Math.random, defaults) {
  const resultado = sortearDetalhado(terreno, rnd, defaults);
  return { arm: resultado.arm, effort: resultado.effort };
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const [cmd, terreno] = process.argv.slice(2);
  if (cmd !== 'sortear' || !terreno) {
    console.error('uso: node braco-experimental.mjs sortear <terreno>');
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(sortear(terreno)));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}
