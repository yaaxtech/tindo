import { readFileSync, writeFileSync, appendFileSync, renameSync, mkdirSync, rmdirSync } from 'node:fs';
import { construirExperimentos, decidirExperimento } from './experimentos-harness.mjs';

export function autorregular({ defaultsFile, auditFile, linhas, sessoes, agora = new Date().toISOString(), aplicar = false }) {
  const lock = `${defaultsFile}.autorregular-lock`;
  if (aplicar) {
    try { mkdirSync(lock); } catch (e) {
      if (e.code === 'EEXIST') return { habilitada: false, gerado_em: agora, motivo: 'Outra avaliação está em andamento', ultima_mudanca: null };
      throw e;
    }
  }
  try {
    const defaults = JSON.parse(readFileSync(defaultsFile, 'utf8'));
    const habilitada = defaults._meta?.auto_aplicar === true && defaults._meta?.governanca === 'experimentos-v1';
    const relatorio = construirExperimentos(defaults, linhas, sessoes, agora);
    const decisoes = [];
    const mudancas = [];
    for (const exp of relatorio.experimentos) {
      const rota = (exp.frente === 'codex' ? defaults.codex.terrenos : defaults.terrenos)[exp.terreno];
      const cfg = rota.experimento;
      if (!cfg.ativo || exp.terreno === 'sql') continue;
      const decisao = decidirExperimento(exp, cfg);
      decisoes.push({ id: exp.id, ...decisao });
      if (!aplicar || !habilitada || !decisao.promover) continue;
      const base = cfg.bracos.find(b => b.id === cfg.base);
      // Compare-and-set protects owner edits and external policy changes.
      if (rota.modelo !== base.modelo || rota.effort !== base.effort) continue;
      const candidato = cfg.bracos.find(b => b.id === decisao.promover);
      const reg = { ts: agora, acao: 'promoveu_experimento', rota: exp.frente, terreno: exp.terreno,
        experiment_id: exp.id, de: { modelo: rota.modelo, effort: rota.effort },
        para: { modelo: candidato.modelo, effort: candidato.effort }, motivo: decisao.motivo,
        evidencia: exp.bracos };
      rota.modelo = candidato.modelo;
      rota.effort = candidato.effort;
      rota.effort_por_modelo ||= {};
      rota.effort_por_modelo[candidato.modelo] = candidato.effort;
      rota.atualizado_em = agora.slice(0, 10);
      cfg.ativo = false;
      cfg.motivo = decisao.motivo;
      cfg.promovido_em = agora;
      mudancas.push(reg);
    }
    if (mudancas.length) {
      const temp = `${defaultsFile}.tmp-${process.pid}`;
      // Write-ahead receipt retains old pair if an interruption occurs.
      appendFileSync(auditFile, `${JSON.stringify({ts:agora,acao:'preparou_promocao',mudancas})}\n`, {mode:0o600});
      writeFileSync(temp, `${JSON.stringify(defaults, null, 2)}\n`, {mode:0o600});
      renameSync(temp, defaultsFile);
      for (const m of mudancas) appendFileSync(auditFile, `${JSON.stringify(m)}\n`, {mode:0o600});
    }
    const motivo = mudancas.length ? `${mudancas.length} mudança(s) sustentada(s) pelos testes`
      : habilitada ? 'Ativa; nenhuma troca demonstrou qualidade preservada e economia com amostra completa'
      : 'Autorregulação desativada na configuração';
    if (aplicar) appendFileSync(auditFile, `${JSON.stringify({ts:agora,acao:'avaliou_experimentos',habilitada,motivo,decisoes})}\n`, {mode:0o600});
    let ultima = mudancas.at(-1)?.ts || null;
    if (!ultima) {
      try {
        const registros = readFileSync(auditFile,'utf8').trim().split('\n').map(l => {try{return JSON.parse(l);}catch{return null;}});
        ultima = registros.filter(r=>r?.acao==='promoveu_experimento').at(-1)?.ts || null;
      } catch(e) { if(e.code !== 'ENOENT') throw e; }
    }
    return { habilitada, gerado_em: agora, motivo, ultima_mudanca: ultima, decisoes, mudancas };
  } finally { if (aplicar) rmdirSync(lock); }
}
