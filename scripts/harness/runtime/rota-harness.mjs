#!/usr/bin/env node
import { existsSync, realpathSync } from 'node:fs';
/**
 * Resolve a rota Codex/Claude a partir dos defaults versionados.
 *
 * Este módulo é puro quando recebe `defaults`: não lê o HOME, não executa
 * modelo e não sorteia uma rota de revisor. O CLI só serializa o resultado.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sortearDetalhado } from './braco-experimental.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = join(ROOT, 'defaults-terreno.json');
const FRENTES = new Set(['codex', 'claude']);
const PAPEIS = new Set(['construtor', 'revisor']);
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

export class ErroRota extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ErroRota';
    this.code = code;
  }
}

function erro(code, message) {
  throw new ErroRota(code, message);
}

function objeto(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function ordenar(v) {
  if (Array.isArray(v)) return v.map(ordenar);
  if (!objeto(v)) return v;
  return Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenar(v[k])]));
}

export function versaoDefaults(defaults) {
  if (!objeto(defaults)) erro('DEFAULTS_INVALIDOS', 'defaults deve ser um objeto');
  const payload = JSON.stringify(ordenar(defaults));
  return `sha256:${createHash('sha256').update(payload).digest('hex')}`;
}

export function versaoExperimento(experimento) {
  if (!objeto(experimento)) erro('EXPERIMENTO_INVALIDO', 'experimento deve ser um objeto');
  const protocolo = Object.fromEntries(Object.entries(experimento)
    .filter(([k]) => !['ativo', 'status', 'motivo', 'desde', 'atualizado_em', 'promovido_em'].includes(k)));
  return `sha256:${createHash('sha256').update(JSON.stringify(ordenar(protocolo))).digest('hex')}`;
}

function lerDefaults(file = DEFAULT_FILE) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    erro('DEFAULTS_INDISPONIVEIS', `não foi possível ler defaults em ${file}: ${e.message}`);
  }
}

function familia(modelo) {
  const m = String(modelo || '').trim().toLowerCase();
  if (!m) return '';
  if (/^(?:gpt-6-)?astra$/.test(m)) return 'astra';
  if (/^(?:gpt-5\.6-)?sol$/.test(m)) return 'sol';
  if (/^(?:gpt-5\.6-)?luna$/.test(m)) return 'luna';
  if (/^(?:gpt-5\.6-)?terra(?:_explorer)?$/.test(m)) return 'terra';
  if (/^(?:claude-)?opus(?:[-_. ]?5)?$/.test(m)) return 'opus5';
  if (/^(?:claude-)?opus[-_. ]?4[-_. ]?8$/.test(m)) return 'opus4_8';
  if (/^(?:claude-)?fable[-_. ]?5[-_. ]?1$/.test(m)) return 'fable5_1';
  if (/^(?:claude-)?fable(?:[-_. ]?5)?$/.test(m)) return 'fable';
  if (/^(?:claude-)?sonnet(?:[-_. ]?5)?$/.test(m)) return 'sonnet';
  if (/^(?:claude-)?haiku(?:[-_. ]?4[-_. ]?5)?$/.test(m)) return 'haiku';
  return '';
}

export function modeloCli(modelo) {
  const f = familia(modelo);
  const ids = {
    astra: 'gpt-6-astra',
    sol: 'gpt-5.6-sol',
    luna: 'gpt-5.6-luna',
    terra: 'gpt-5.6-terra',
    opus5: 'opus',
    opus4_8: 'opus-4.8',
    sonnet: 'sonnet',
    fable: 'fable',
    fable5_1: 'claude-fable-5-1',
    haiku: 'haiku',
  };
  return ids[f] || '';
}

function modeloLog(modelo) {
  const f = familia(modelo);
  const ids = {
    astra: 'gpt-6-astra',
    sol: 'gpt-5.6-sol',
    luna: 'gpt-5.6-luna',
    terra: 'gpt-5.6-terra',
    opus5: 'opus-5',
    opus4_8: 'opus-4.8',
    sonnet: 'sonnet',
    fable: 'fable',
    fable5_1: 'fable-5.1',
    haiku: 'haiku',
  };
  return ids[f] || '';
}

function provedor(modelo) {
  const f = familia(modelo);
  if (['astra', 'sol', 'luna', 'terra'].includes(f)) return 'codex';
  if (['opus5', 'opus4_8', 'sonnet', 'fable', 'fable5_1', 'haiku'].includes(f)) return 'claude';
  return null;
}

function texto(v, nome) {
  if (v == null || String(v).trim() === '') erro('ROTA_INVALIDA', `${nome} é obrigatório`);
  return String(v).trim();
}

function validarEffort(v, nome = 'effort') {
  const e = texto(v, nome);
  if (!EFFORTS.has(e)) erro('EFFORT_INVALIDO', `${nome} inválido: ${e}; use ${[...EFFORTS].join('|')}`);
  return e;
}

function paresConfigurados(cfg) {
  const out = [];
  for (const [m, e] of Object.entries(cfg.effort_por_modelo || {})) {
    if (typeof e === 'string' && familia(m)) out.push({ modelo: familia(m), effort: e });
  }
  if (cfg.modelo && cfg.effort && familia(cfg.modelo)) out.push({ modelo: familia(cfg.modelo), effort: cfg.effort });
  return out;
}

function parIgual(a, b) {
  return familia(a.modelo) === familia(b.modelo) && a.effort === b.effort;
}

function fallbackEntries(cfg, motivo) {
  if (!motivo) return [];
  const porMotivo = cfg.fallback_por_motivo?.[motivo];
  if (Array.isArray(porMotivo)) return porMotivo;
  if (motivo === 'qualidade' && Array.isArray(cfg.fallback)) {
    return cfg.fallback.map((modelo) => ({ modelo, effort: cfg.effort_por_modelo?.[modelo] }));
  }
  return [];
}

function effortConfigurado(cfg, modelo) {
  const f = familia(modelo);
  if (!f) return null;
  const direto = cfg.effort_por_modelo?.[f] || cfg.effort_por_modelo?.[modelo];
  if (direto) return direto;
  const chave = Object.keys(cfg.effort_por_modelo || {})
    .find((k) => familia(k) === f);
  return chave ? cfg.effort_por_modelo[chave] : null;
}

function escolherDefault(cfg, frente, terreno, papel, motivo) {
  if (motivo) {
    const candidatos = fallbackEntries(cfg, motivo).filter((p) => p && p.modelo && p.effort);
    if (!candidatos.length) {
      erro('FALLBACK_NAO_CONFIGURADO', `fallback '${motivo}' não configurado para ${frente}/${terreno}`);
    }
    return { ...candidatos[0], origem: 'fallback' };
  }
  if (!cfg.modelo || !cfg.effort) {
    erro('DEFAULT_INCOMPLETO', `default de ${frente}/${terreno} não tem modelo e effort`);
  }
  const effort = cfg.effort;
  if (!effort) erro('DEFAULT_INCOMPLETO', `default de ${frente}/${terreno} não tem effort configurado`);
  return { modelo: cfg.modelo, effort, origem: 'default' };
}

function validarRotaForte({terreno,papel,par,modeloAutor}) {
  if (terreno !== 'sql') return;
  const fortes={opus5:'high',sol:'xhigh',astra:'xhigh'};
  if (fortes[familia(par.modelo)] !== par.effort) erro('SQL_ROTA_FRACA','SQL exige Opus 5/high, Sol/xhigh ou Astra/xhigh');
  if (papel==='revisor' && !fortes[familia(modeloAutor)]) erro('SQL_AUTOR_INVALIDO','Autor SQL sem modelo forte reconhecido');
}

function validarParConfigurado(cfg, par, motivo, roteamentoOk, experimento) {
  if (experimento || roteamentoOk) return;
  if (motivo) {
    if (!fallbackEntries(cfg, motivo).some((p) => p && parIgual(p, par))) {
      erro('FALLBACK_FORA_DA_ROTA', `modelo/effort ${par.modelo}/${par.effort} não é fallback configurado para '${motivo}'`);
    }
    return;
  }
  if (!paresConfigurados(cfg).some((p) => parIgual(p, par))) {
    erro('ROTA_FORA_DO_DEFAULT', `modelo/effort ${par.modelo}/${par.effort} não está configurado para este terreno`);
  }
}

function validarRevisor({ cfg, par, modeloAutor, fallbackProprio, roteamentoOk }) {
  if (!modeloAutor) erro('REVISOR_SEM_AUTOR', 'revisor exige modelo autor');
  const autor = familia(modeloAutor);
  const revisor = familia(par.modelo);
  if (provedor(modeloAutor) === provedor(par.modelo) && !fallbackProprio) {
    erro('REVISAO_NAO_CRUZADA', `revisor ${revisor} não pode aprovar autor ${autor} sem fallback próprio comprovado`);
  }
  const candidatos = cfg.revisao_por_modelo?.[autor] || (cfg.revisao?.modelo
    ? [{ modelo: cfg.revisao.modelo, effort: cfg.revisao.effort },
      ...(cfg.revisao.fallback_proprio ? [cfg.revisao.fallback_proprio] : [])]
    : []);
  if (candidatos.length && !roteamentoOk && !candidatos.some((p) => parIgual(p, par))) {
    erro('REVISOR_FORA_DA_ROTA', `revisão ${revisor}/${par.effort} não está configurada para autor ${autor}`);
  }
}

export function resolverRota({
  frente = 'codex',
  terreno,
  papel = 'construtor',
  modelo,
  effort,
  modeloAutor,
  fallbackMotivo,
  fallbackProprio = false,
  roteamentoOk,
  defaults,
  random,
} = {}) {
  if (!FRENTES.has(frente)) erro('FRENTE_DESCONHECIDA', `frente desconhecida: ${frente}`);
  if (!terreno) erro('TERRENO_OBRIGATORIO', 'terreno é obrigatório');
  if (!PAPEIS.has(papel)) erro('PAPEL_INVALIDO', `papel inválido: ${papel}`);
  if (fallbackProprio && !['outro_harness_indisponivel','outro_harness_saida_invalida'].includes(fallbackMotivo)) {
    erro('FALLBACK_SEM_CAUSA','Revisão própria exige indisponibilidade ou saída inválida registrada');
  }
  const cfgRaiz = defaults || lerDefaults();
  const rotas = frente === 'codex' ? cfgRaiz.codex?.terrenos : cfgRaiz.terrenos;
  if (!rotas || !Object.prototype.hasOwnProperty.call(rotas, terreno)) {
    erro('TERRENO_DESCONHECIDO', `terreno desconhecido em ${frente}.terrenos: ${terreno}`);
  }
  const cfg = rotas[terreno];
  const configVersion = versaoDefaults(cfgRaiz);
  const explicitModel = modelo != null && String(modelo).trim() !== '';
  const explicitEffort = effort != null && String(effort).trim() !== '';
  let escolhido;
  let metadados = { experiment_id: null, arm: null };

  if (papel === 'revisor') {
    if (!explicitModel || !explicitEffort) {
      erro('REVISOR_EXPLICITO', 'revisor exige modelo e effort escolhidos explicitamente');
    }
    escolhido = { modelo, effort: validarEffort(effort), origem: 'explicito' };
    validarRevisor({ cfg, par: escolhido, modeloAutor, fallbackProprio, roteamentoOk });
  } else {
    const motivo = fallbackMotivo ? texto(fallbackMotivo, 'fallback_motivo') : null;
    if ((motivo || roteamentoOk) && explicitModel && explicitEffort) {
      escolhido = { modelo, effort: validarEffort(effort), origem: motivo ? 'fallback' : 'explicito' };
    } else {
      escolhido = escolherDefault(cfg, frente, terreno, papel, motivo);
      if (motivo || roteamentoOk) {
        if (explicitModel) escolhido.modelo = modelo;
        if (explicitEffort) escolhido.effort = validarEffort(effort);
      }
    }
    validarParConfigurado(cfg, escolhido, motivo, roteamentoOk, false);
    const podeSortear = !motivo && !roteamentoOk && frente === 'codex' && terreno !== 'sql';
    if (podeSortear) {
      const sorteio = sortearDetalhado(terreno, random, cfgRaiz, escolhido);
      if (sorteio?.experiment_id) {
        escolhido.modelo = sorteio.modelo;
        escolhido.effort = validarEffort(sorteio.effort);
        escolhido.origem = 'experimento';
        metadados = {
          experiment_id: sorteio.experiment_id,
          arm: sorteio.arm,
        };
      }
    }
  }

  const par = { modelo: familia(escolhido.modelo), effort: escolhido.effort };
  validarRotaForte({ frente, terreno, papel, cfg, par, modeloAutor, fallbackProprio, fallbackMotivo, roteamentoOk });
  const cli = modeloCli(escolhido.modelo);
  const provider = provedor(escolhido.modelo);
  if (!provider) erro('MODELO_DESCONHECIDO', `modelo sem provedor conhecido: ${escolhido.modelo}`);
  const experimentVersion = metadados.experiment_id
    ? versaoExperimento(cfg.experimento || cfg.braco_experimental_xhigh)
    : null;
  return {
    frente,
    rota_origem: frente,
    terreno,
    papel,
    familia: par.modelo,
    modelo: modeloLog(escolhido.modelo),
    modelo_cli: cli,
    modelo_log: modeloLog(escolhido.modelo),
    modelo_id: cli,
    effort: escolhido.effort,
    provider,
    provedor: provider,
    origem: escolhido.origem,
    fallback_motivo: fallbackMotivo || null,
    roteamento_ok: roteamentoOk || null,
    experiment_id: metadados.experiment_id,
    arm: metadados.arm,
    experiment_version: experimentVersion,
    experimentVersion,
    config_version: configVersion,
    configVersion,
    modelo_autor: modeloAutor ? modeloCli(modeloAutor) : null,
    fallback_proprio: Boolean(fallbackProprio),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith('--') ? argv[++i] : 'true';
  }
  return args;
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (cmd !== 'resolver') {
    console.error('uso: node rota-harness.mjs resolver --frente codex --terreno rotina [--papel construtor]');
    process.exit(2);
  }
  try {
    const defaults = args.defaults ? lerDefaults(args.defaults) : undefined;
    const random = args.random == null ? undefined : () => Number(args.random);
    const rota = resolverRota({
      frente: args.frente,
      terreno: args.terreno,
      papel: args.papel,
      modelo: args.modelo,
      effort: args.effort,
      modeloAutor: args['modelo-autor'],
      fallbackMotivo: args['fallback-motivo'],
      fallbackProprio: args['fallback-proprio'] === 'true',
      roteamentoOk: args['roteamento-ok'],
      defaults,
      random,
    });
    console.log(JSON.stringify(rota));
  } catch (e) {
    console.error(`rota-harness: ${e.code || 'ROTA_INVALIDA'}: ${e.message}`);
    process.exit(2);
  }
}
