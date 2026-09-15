#!/usr/bin/env node
import { existsSync, realpathSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolverRota } from './rota-harness.mjs';

const DIR=dirname(fileURLToPath(import.meta.url));
export function classificarFalha(resposta, provider) {
  if (resposta.status===0) return null;
  const diagnostico=`${resposta.stderr || ''}\n${resposta.stdout || ''}\n${resposta.error?.code || ''}`;
  const sufixo=provider==='codex'?'openai':'anthropic';
  let saidaDeTarefa=Boolean(String(resposta.stdout || '').trim());
  try { if (JSON.parse(resposta.stdout || '{}').is_error===true) saidaDeTarefa=false; } catch { /* plain CLI output */ }
  if (/monthly spend limit|usage limit|message limit|quota|rate.limit|limit reached|credit balance is too low/i.test(diagnostico))
    return `quota_${sufixo}`;
  if (/not logged in|authentication|unauthorized|expired.*token|sem_conta|sem.token|ENOENT|command not found|no such file|not authenticated/i.test(diagnostico))
    return `indisponivel_${sufixo}`;
  if (!saidaDeTarefa && /\b503\b|overloaded|service unavailable|temporarily unavailable|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|fetch failed|network error/i.test(diagnostico))
    return `indisponivel_${sufixo}`;
  // Retry a timeout only when the CLI produced no task output. Once a task
  // started, repeating it could duplicate an external effect.
  if ((resposta.error?.code==='ETIMEDOUT' || resposta.status===null || resposta.signal) &&
      !saidaDeTarefa) return `indisponivel_${sufixo}`;
  return null;
}
export function executarDespacho({frente='codex',terreno,prompt,cwd=process.cwd(),defaults,
  invocar,random=Math.random,fallbackMotivoInicial}) {
  const usados=new Set(/_openai$/.test(fallbackMotivoInicial || '')?['codex']:
    /_anthropic$/.test(fallbackMotivoInicial || '')?['claude']:[]);
  const sorteio=random();
  let motivo=fallbackMotivoInicial;
  const tentativas=[];
  for(let i=0;i<2;i++) {
    const rota=resolverRota({frente,terreno,defaults,random:()=>sorteio,fallbackMotivo:motivo});
    if(usados.has(rota.provider)) break; // Quota applies to the whole provider.
    usados.add(rota.provider);
    const resposta=invocar(rota,{prompt,cwd,sorteio,motivo});
    tentativas.push({provider:rota.provider,modelo:rota.modelo,effort:rota.effort,codigo:resposta.status});
    if(resposta.status===0) return {ok:true,tentativas,resposta};
    const proximo=classificarFalha(resposta,rota.provider);
    if(!proximo) {
      return {ok:false,tentativas,resposta};
    }
    motivo=proximo;
    if(usados.size===2) break;
  }
  return {ok:false,tentativas,resposta:{status:1,stderr:'Os provedores disponíveis não concluíram o despacho; nenhuma repetição automática adicional.'}};
}

if(process.argv[1] && existsSync(process.argv[1]) && import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href) {
  const a=Object.fromEntries(process.argv.slice(2).reduce((out,x,i,all)=>{
    if(x.startsWith('--'))out.push([x.slice(2),all[i+1]]);return out;
  },[]));
  try {
    if(!a.terreno || !a['prompt-file'])throw new Error('--terreno e --prompt-file obrigatórios');
    const defaultsFile=process.env.HARNESS_DEFAULTS_FILE || join(DIR,'defaults-terreno.json');
    const defaults=JSON.parse(readFileSync(defaultsFile,'utf8'));
    const prompt=readFileSync(a['prompt-file'],'utf8');
    const result=executarDespacho({frente:a.frente || 'codex',terreno:a.terreno,prompt,cwd:a.cwd,defaults,fallbackMotivoInicial:a['fallback-motivo'],
      random:process.env.HARNESS_RANDOM ? () => Number(process.env.HARNESS_RANDOM) : Math.random,
      invocar:(rota,{prompt,cwd,sorteio,motivo})=>{
        const env={...process.env,HARNESS_RUNTIME_DIR:DIR,HARNESS_FRENTE:a.frente || 'codex',
          HARNESS_RANDOM:String(sorteio),HARNESS_DISPATCH_DEPTH:'1',LEDGER_TERRENO:a.terreno,LEDGER_PAPEL:'construtor'};
        if(motivo)env.LEDGER_FALLBACK_MOTIVO=motivo;
        else delete env.LEDGER_FALLBACK_MOTIVO;
        if(rota.provider==='codex')return spawnSync('bash',[
          process.env.HARNESS_CODEX_WRAPPER || join(homedir(),'.claude/workers/codex/run.sh'),
          '--skip-git-repo-check',prompt],{cwd,env,encoding:'utf8',timeout:90*60e3,maxBuffer:16*1024*1024});
        const start=Date.now();
        const r=spawnSync(process.env.HARNESS_CLAUDE_WRAPPER || join(homedir(),'.claude/workers/claude/claude-por-modo.sh'),[
          '--print','--model',rota.modelo_cli,'--effort',rota.effort,'--output-format','json',prompt],
          {cwd,env,encoding:'utf8',timeout:90*60e3,maxBuffer:16*1024*1024});
        try { if(JSON.parse(r.stdout || '{}').is_error===true) r.status=1; } catch { /* CLI may emit plain diagnostics. */ }
        const resultado=r.status===0?'pendente':classificarFalha(r,'claude')==='quota_anthropic'?'quota':'infra';
        spawnSync(process.execPath,[join(DIR,'ledger.mjs'),'log','--frente','claude',
          '--modelo',rota.modelo_log,'--effort',rota.effort,'--terreno',a.terreno,
          '--papel','construtor','--resultado',resultado,'--tarefa','Despacho pelo resolver comum',
          '--dur',String((Date.now()-start)/60000),'--rota-origem',a.frente || 'codex',
          '--config-version',rota.config_version,'--auto'],{env,encoding:'utf8'});
        return r;
      }});
    if(result.resposta?.stdout)process.stdout.write(result.resposta.stdout);
    if(result.resposta?.stderr)process.stderr.write(result.resposta.stderr);
    process.exit(result.ok?0:result.resposta?.status || 1);
  } catch(e) { console.error(e.message);process.exit(2); }
}
