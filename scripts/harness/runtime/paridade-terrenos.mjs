// paridade-terrenos.mjs — rede que trava o drift entre as DUAS cópias
// máquina-legíveis da governança de tier por terreno:
//
//   defaults-terreno.json  (FONTE — o cérebro lê daqui p/ escolher modelo/effort,
//                            o motor auto-subir.mjs escreve aqui)
//        │  enriquecimento em painel.mjs (effort/effort_teto/modelo_no_teto)
//        ▼
//   CADEIAS de painel.mjs  (rótulo/default/fallback/revisor escritos À MÃO)
//        │  publicar-painel.mjs empurra VERBATIM como blob `cadeias`
//        ▼
//   tela /harness do TinDo  (consome o blob; recomputa o sinal)
//
// A 3ª perna (TinDo) é igual à 2ª POR CONSTRUÇÃO (blob verbatim), então basta
// travar JSON ↔ CADEIAS. O risco real é o CADEIAS escrito à mão (default,
// fallback, nunca_externo) envelhecer calado quando o motor mudar o JSON:
// aí a tela mostra "Luna" num terreno que já virou Sonnet, e o dono lê
// instrumento mentindo. Este script falha ALTO nesse caso.
//
// NÃO parseia a prosa do CLAUDE.md de propósito: prosa é governança humana,
// muda devagar e por decisão minha; parsear texto livre é frágil e seria o
// over-engineering que o incidente de SQL já ensinou a evitar. A prosa segue
// como explicação; o JSON é a fonte operacional.
//
// Roda avulso: `node paridade-terrenos.mjs` (sai 1 em qualquer divergência).
// Importável sem efeito: `import { verificarParidade } from './paridade-terrenos.mjs'`.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CADEIAS as CADEIAS_PADRAO } from './painel.mjs';
// MODELO carrega provider/custo de cada modelo. auto-subir.mjs é puro (guarda
// de CLI), então importar não dispara efeito.
import { MODELO } from './auto-subir.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));

// código do modelo no JSON → texto que PRECISA aparecer na string do painel.
// Code ausente daqui = falha proposital: força manter o mapa quando um modelo
// novo entrar numa cadeia.
const NOME_MODELO = {
  luna: 'Luna',
  sol: 'Sol',
  fable: 'Fable',
  opus5: 'Opus 5',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
};

/**
 * @returns {{ ok: boolean, problemas: string[] }}
 */
export function verificarParidade({defaults, cadeias} = {}) {
  const CADEIAS = cadeias || CADEIAS_PADRAO;
  const problemas = [];
  const push = (t, msg) => problemas.push(`[${t}] ${msg}`);

  const raw = defaults || JSON.parse(
    readFileSync(join(DIR, 'defaults-terreno.json'), 'utf8'),
  );
  const escala = raw._meta?.escala_effort;
  const terrenos = raw.terrenos || {};

  if (!Array.isArray(escala) || escala.length === 0) {
    problemas.push('[_meta] escala_effort ausente ou vazia');
    return { ok: false, problemas };
  }
  const idxEffort = (e) => escala.indexOf(e);

  // 1) mesmo conjunto de terrenos nos dois lados
  const kJson = Object.keys(terrenos).sort();
  const kPainel = Object.keys(CADEIAS).sort();
  if (kJson.join(',') !== kPainel.join(',')) {
    problemas.push(
      `conjunto de terrenos difere — JSON=[${kJson}] painel=[${kPainel}]`,
    );
    // segue mesmo assim, checando a interseção
  }

  for (const t of kPainel) {
    const c = CADEIAS[t];
    const d = terrenos[t];
    if (!d) {
      push(t, 'existe no painel mas NÃO no defaults-terreno.json');
      continue;
    }

    // 2) effort / effort_teto: o painel deve ter puxado o valor do JSON
    if (c.effort !== (d.effort || null)) {
      push(t, `effort painel=${c.effort} ≠ json=${d.effort} (enriquecimento falhou?)`);
    }
    if (c.effort_teto !== (d.effort_teto || null)) {
      push(t, `effort_teto painel=${c.effort_teto} ≠ json=${d.effort_teto}`);
    }

    // 3) effort dentro da escala e ≤ teto (guarda de sanidade do JSON)
    if (d.effort && idxEffort(d.effort) === -1) {
      push(t, `effort '${d.effort}' fora da escala [${escala}]`);
    }
    if (d.effort_teto && idxEffort(d.effort_teto) === -1) {
      push(t, `effort_teto '${d.effort_teto}' fora da escala [${escala}]`);
    }
    if (
      d.effort &&
      d.effort_teto &&
      idxEffort(d.effort) !== -1 &&
      idxEffort(d.effort_teto) !== -1 &&
      idxEffort(d.effort) > idxEffort(d.effort_teto)
    ) {
      push(t, `effort '${d.effort}' já passou do teto '${d.effort_teto}'`);
    }

    // 4) modelo_no_teto = (piso_modelo === teto_modelo), derivado igual dos 2 lados
    const noTetoJson = !!(
      d.piso_modelo && d.teto_modelo && d.piso_modelo === d.teto_modelo
    );
    if (!!c.modelo_no_teto !== noTetoJson) {
      push(t, `modelo_no_teto painel=${!!c.modelo_no_teto} ≠ derivado do json=${noTetoJson}`);
    }

    // 5) nunca_externo casado (o do painel é escrito à mão)
    if (!!c.nunca_externo !== !!d.nunca_externo) {
      push(t, `nunca_externo painel=${!!c.nunca_externo} ≠ json=${!!d.nunca_externo}`);
    }

    // 6) titular: o modelo do JSON tem de aparecer na string `default` do painel
    const nomeTitular = NOME_MODELO[d.modelo];
    if (!nomeTitular) {
      push(t, `modelo '${d.modelo}' sem tradução em NOME_MODELO — mapa desatualizado`);
    } else if (!String(c.default).includes(nomeTitular)) {
      push(t, `default do painel '${c.default}' não cita o titular do json '${d.modelo}' (${nomeTitular})`);
    }

    // 7) fallbacks: cada modelo da cadeia (fora o titular) deve aparecer em
    //    alguma string de fallback do painel
    const cadeia = Array.isArray(d.cadeia_modelo) ? d.cadeia_modelo : [];
    const fbPainel = (c.fallback || []).join(' | ');
    for (const cod of cadeia) {
      if (cod === d.modelo) continue; // titular já checado no default
      const nome = NOME_MODELO[cod];
      if (!nome) {
        push(t, `cadeia_modelo tem '${cod}' sem tradução em NOME_MODELO`);
      } else if (!fbPainel.includes(nome)) {
        push(t, `cadeia_modelo do json tem '${cod}' (${nome}) mas o fallback do painel [${fbPainel}] não cita`);
      }
    }

    // 7b) Modelo sem effort é uma rota pela metade. Modelo e effort são
    // evidências separadas; cada degrau declara os dois.
    const effortPorModelo = d.effort_por_modelo || {};
    for (const cod of cadeia) {
      const effort = effortPorModelo[cod];
      if (!effort) {
        push(t, `modelo '${cod}' da cadeia sem effort_por_modelo`);
      } else if (idxEffort(effort) === -1) {
        push(t, `effort_por_modelo.${cod}='${effort}' fora da escala [${escala}]`);
      }
    }
    if (d.modelo && effortPorModelo[d.modelo] !== d.effort) {
      push(t, `par titular '${d.modelo}/${d.effort}' diverge de effort_por_modelo.${d.modelo}='${effortPorModelo[d.modelo] ?? 'ausente'}'`);
    }
    if (!d.evidencia_modelo || !d.evidencia_effort) {
      push(t, 'evidencia_modelo e evidencia_effort são obrigatórias e separadas');
    }

    // 7c) Fallback é por CAUSA, não uma lista cega. Quota do OpenAI elimina
    // Luna e Sol juntos. Todo degrau leva modelo+effort para o cérebro não
    // inventar effort no uso.
    const porMotivo = d.fallback_por_motivo;
    if (!porMotivo || typeof porMotivo !== 'object' || Array.isArray(porMotivo)) {
      push(t, 'fallback_por_motivo ausente ou inválido');
    } else {
      for (const [motivo, passos] of Object.entries(porMotivo)) {
        if (!Array.isArray(passos)) {
          push(t, `fallback_por_motivo.${motivo} precisa ser array`);
          continue;
        }
        for (const [i, passo] of passos.entries()) {
          if (!passo?.modelo || !MODELO[passo.modelo]) {
            push(t, `fallback_por_motivo.${motivo}[${i}] tem modelo desconhecido '${passo?.modelo ?? 'ausente'}'`);
          }
          if (!passo?.effort || idxEffort(passo.effort) === -1) {
            push(t, `fallback_por_motivo.${motivo}[${i}] tem effort inválido '${passo?.effort ?? 'ausente'}'`);
          }
        }
      }
    }

    // 7d) Quem constrói tenta primeiro o OUTRO harness. A própria família só
    // pode aparecer depois, marcada como fallback próprio; ela nunca é a
    // primeira tentativa e só roda após falha comprovada da anterior.
    const revisao = d.revisao_por_modelo || {};
    for (const autor of cadeia) {
      const revisores = revisao[autor];
      if (!Array.isArray(revisores) || revisores.length === 0) {
        push(t, `revisao_por_modelo.${autor} ausente ou vazia`);
        continue;
      }
      for (const [i, revisor] of revisores.entries()) {
        const mesmaFamilia = !!(
          MODELO[autor]?.provider &&
          MODELO[revisor?.modelo]?.provider === MODELO[autor].provider
        );
        if (!revisor?.modelo || !MODELO[revisor.modelo]) {
          push(t, `revisao_por_modelo.${autor}[${i}] tem modelo desconhecido '${revisor?.modelo ?? 'ausente'}'`);
        } else if (i === 0 && mesmaFamilia) {
          push(t, `revisao_por_modelo.${autor}[0] precisa usar outro harness primeiro`);
        } else if (i === 0 && revisor.outro_harness_primeiro !== true) {
          push(t, `revisao_por_modelo.${autor}[0] precisa declarar outro_harness_primeiro=true`);
        } else if (i > 0 && mesmaFamilia && revisor.fallback_proprio !== true) {
          push(t, `revisao_por_modelo.${autor}[${i}] usa a própria família sem fallback_proprio=true`);
        }
        if (revisor?.fallback_proprio === true && i === 0) {
          push(t, `revisao_por_modelo.${autor}[0] não pode começar pelo fallback próprio`);
        }
        if (!revisor?.effort || idxEffort(revisor.effort) === -1) {
          push(t, `revisao_por_modelo.${autor}[${i}] tem effort inválido '${revisor?.effort ?? 'ausente'}'`);
        }
      }
    }
  }

  // 8) Invariante de dinheiro: nunca_externo + allowlist explícita. Ranking
  //    externo ajuda a revisar a allowlist, mas não afrouxa controle sozinho.
  for (const [t, d] of Object.entries(terrenos)) {
    if (!d.modelos_permitidos?.length) continue;
    const paresFortes = {opus5:'high',sol:'xhigh',astra:'xhigh'};
    for (const modelo of d.modelos_permitidos) {
      if (!paresFortes[modelo] || d.effort_por_modelo?.[modelo] !== paresFortes[modelo]) {
        push(t, `modelo permitido ${modelo} sem par forte para SQL`);
      }
    }
    for (const papel of ['piso_modelo', 'teto_modelo']) {
      const cod = d[papel];
      const m = MODELO[cod];
      if (!m) {
        push(t, `${papel}='${cod}' sem metadados em MODELO (auto-subir.mjs)`);
        continue;
      }
      if (!d.modelos_permitidos.includes(cod)) {
        push(t, `${papel}='${cod}' fora de modelos_permitidos=[${d.modelos_permitidos}]`);
      }
    }
  }

  return { ok: problemas.length === 0, problemas };
}

// CLI: só imprime e sai — sem efeito externo (não manda e-mail, não escreve
// nada), então não precisa da guarda de import dos scripts de efeito real.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { ok, problemas } = verificarParidade();
  if (ok) {
    console.log('✓ paridade OK — defaults-terreno.json ≡ CADEIAS do painel (≡ blob da tela)');
    process.exit(0);
  }
  console.error(`✗ ${problemas.length} divergência(s) de paridade:`);
  for (const p of problemas) console.error(`  - ${p}`);
  process.exit(1);
}
