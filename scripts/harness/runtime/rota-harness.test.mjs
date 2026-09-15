import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdtempSync,chmodSync,mkdirSync,existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolverRota,versaoExperimento } from './rota-harness.mjs';
import { executarDespacho } from './despachar-harness.mjs';
import { reciboEventos } from './codex-eventos.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const cfg=JSON.parse(readFileSync(join(dir,'defaults-terreno.example.json'),'utf8'));
cfg.terrenos={...cfg.terrenos,...cfg.codex.terrenos};
for (const terreno of Object.values(cfg.terrenos)) {
 terreno.fallback_por_motivo ||= {};
 for (const [motivo,modelo,effort] of [
  ['quota_openai','opus5','high'],['indisponivel_openai','opus5','high'],
  ['quota_anthropic','sol',terreno.modelo==='opus5'&&terreno.effort==='high'?'xhigh':'high'],
  ['indisponivel_anthropic','sol',terreno.modelo==='opus5'&&terreno.effort==='high'?'xhigh':'high']])
  terreno.fallback_por_motivo[motivo]=[{modelo,effort}];
}
test('stale explicit flags cannot bypass the configured default or random assignment',()=>{
 const a=resolverRota({defaults:cfg,terreno:'rotina',modelo:'gpt-6-astra',effort:'xhigh',random:()=>0.1});
 assert.equal(a.modelo_cli,'gpt-5.6-sol');assert.equal(a.effort,'low');assert.equal(a.arm,'sol-low');
 const b=resolverRota({defaults:cfg,terreno:'rotina',random:()=>0.9});assert.equal(b.modelo_cli,'gpt-5.6-luna');assert.equal(b.arm,'luna-max');
 assert.throws(()=>resolverRota({defaults:cfg,terreno:'unknown'}),/desconhecido/);
 const sql=resolverRota({defaults:cfg,terreno:'sql',fallbackMotivo:'quota_openai'});
 assert.equal(sql.provider,'claude');assert.equal(sql.effort,'high');assert.equal(sql.experiment_id,null);
});
test('origin never changes the same terrain, experiment arm, or cross-provider fallback',()=>{
 const shared=structuredClone(cfg);
 shared.terrenos.ui={...structuredClone(shared.terrenos.rotina),modelo:'fable',effort:'low',experimento:null};
 shared.terrenos.analise={...structuredClone(shared.terrenos.rotina),modelo:'opus5',effort:'high',experimento:null};
 shared.terrenos.mecanico={...structuredClone(shared.terrenos.rotina),modelo:'luna',effort:'low',experimento:null};
 shared.terrenos.dificil={...structuredClone(shared.terrenos.rotina),modelo:'sol',effort:'high',experimento:null};
 shared.terrenos.sql.modelo='opus5';shared.terrenos.sql.effort='high';
 for(const reason of ['quota_anthropic','indisponivel_anthropic'])
  shared.terrenos.sql.fallback_por_motivo[reason]=[{modelo:'sol',effort:'xhigh'}];
 shared.codex.terrenos.rotina.modelo='astra'; // stale source is ignored
 for(const [terreno,config] of Object.entries(shared.terrenos)){
  for(const random of [0.1,0.9]){
   const a=resolverRota({defaults:shared,frente:'codex',terreno,random:()=>random});
   const b=resolverRota({defaults:shared,frente:'claude',terreno,random:()=>random});
   assert.deepEqual([a.modelo,a.effort,a.arm,a.experiment_id],[b.modelo,b.effort,b.arm,b.experiment_id]);
  }
  const provider=resolverRota({defaults:shared,terreno,random:()=>0.1}).provider;
  const reason=provider==='codex'?'quota_openai':'quota_anthropic';
  const fallback=resolverRota({defaults:shared,frente:'claude',terreno,fallbackMotivo:reason});
  assert.notEqual(fallback.provider,provider,terreno);
  const unavailable=resolverRota({defaults:shared,frente:'codex',terreno,fallbackMotivo:reason.replace('quota','indisponivel')});
  assert.equal(unavailable.provider,fallback.provider,terreno);
 }
});
test('quota switches provider once; ordinary failure never repeats',()=>{
 const calls=[];
 const r=executarDespacho({terreno:'rotina',defaults:cfg,random:()=>0.1,prompt:'prepare local code',invocar:rota=>{
  calls.push(rota.provider);return rota.provider==='codex'?{status:1,stderr:'usage limit'}:{status:0,stdout:'ok'};
 }});
 assert.equal(r.ok,true);assert.deepEqual(calls,['codex','claude']);
 let n=0;executarDespacho({terreno:'rotina',defaults:cfg,prompt:'code',invocar:()=>{n++;return {status:1,stderr:'syntax error'};}});assert.equal(n,1);
});
test('spend limit, authentication and missing CLI switch provider; task output and timeout do not duplicate work',()=>{
 for(const failure of [{status:1,stderr:'monthly spend limit reached'},
   {status:1,stderr:'not authenticated'}, {status:null,error:{code:'ENOENT'}},
   {status:1,stderr:'503 service unavailable'}, {status:1,stderr:'overloaded'},
   {status:null,error:{code:'ECONNRESET'}}]){
  const calls=[];
  const result=executarDespacho({terreno:'analise',defaults:{...cfg,terrenos:{...cfg.terrenos,analise:{modelo:'opus5',effort:'high',fallback_por_motivo:cfg.terrenos.rotina.fallback_por_motivo}}},
   invocar:rota=>{calls.push(rota.provider);return calls.length===1?failure:{status:0,stdout:'ok'};}});
  assert.equal(result.ok,true,JSON.stringify(failure));assert.deepEqual(calls,['claude','codex']);
 }
 const calls=[];
 executarDespacho({terreno:'rotina',defaults:cfg,random:()=>0.1,invocar:rota=>{
  calls.push(rota.provider);return {status:null,error:{code:'ETIMEDOUT'},stdout:'task already started'};}});
 assert.deepEqual(calls,['codex']);
 const transportCalls=[];
 executarDespacho({terreno:'rotina',defaults:cfg,random:()=>0.1,invocar:rota=>{
  transportCalls.push(rota.provider);return {status:1,stderr:'503 service unavailable',stdout:'task already started'};}});
 assert.deepEqual(transportCalls,['codex']);
});
test('session receipt belongs to this process, not latest concurrent file',()=>{
 assert.deepEqual(reciboEventos('{"type":"thread.started","thread_id":"abc"}\n{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":80,"output_tokens":20}}'),{session_id:'abc',tokens:120});
 assert.equal(reciboEventos('{"type":"thread.started","thread_id":"a"}\n{"type":"thread.started","thread_id":"b"}').session_id,null);
});
test('fake executor proves effective arguments -> output -> ledger trial metadata',()=>{
 const temp=mkdtempSync(join(tmpdir(),'harness-launcher-'));
 const defaultsFile=join(temp,'defaults.json');writeFileSync(defaultsFile,JSON.stringify(cfg));
 const bin=join(temp,'fake-codex');const ledger=join(temp,'ledger.jsonl');
 writeFileSync(bin,`#!/usr/bin/env node\nconst fs=require('node:fs');fs.writeFileSync(process.env.ARGUMENT_FILE,JSON.stringify(process.argv.slice(2)));console.log(JSON.stringify({type:'thread.started',thread_id:'fixture-session'}));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'DONE'}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:100,output_tokens:20}}));\n`);chmodSync(bin,0o700);mkdirSync(join(temp,'marcos'));
 const r=spawnSync('bash',[join(dir,'codex-run.sh'),'-m','gpt-6-astra','-c','model_reasoning_effort="xhigh"','Implement a pure sum function in this temporary test fixture.'],{
  env:{...process.env,HARNESS_CODEX_BIN:bin,HARNESS_RUNTIME_DIR:dir,HARNESS_DEFAULTS_FILE:defaultsFile,HARNESS_LEDGER_FILE:ledger,HARNESS_MARCOS_DIR:join(temp,'marcos'),HARNESS_RANDOM:'0.1',LEDGER_TERRENO:'rotina',LEDGER_PAPEL:'construtor',CODEX_TIMEOUT_MIN:'0',CODEX_CONSTRUCAO_CROSS_HARNESS:'0',ARGUMENT_FILE:join(temp,'args.json')},encoding:'utf8',timeout:20000});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/DONE/);
 const argv=JSON.parse(readFileSync(join(temp,'args.json')));assert.equal(argv[argv.indexOf('-m')+1],'gpt-5.6-sol');assert.ok(argv.includes('model_reasoning_effort="low"'));
 const row=JSON.parse(readFileSync(ledger,'utf8').trim());assert.equal(row.modelo,'gpt-5.6-sol');assert.equal(row.arm,'sol-low');assert.equal(row.session_id,'fixture-session');assert.equal(row.tokens,120);assert.equal(row.classificacao,'declarada');assert.equal(row.experiment_version,versaoExperimento(cfg.terrenos.rotina.experimento));
 const uiCfg=structuredClone(cfg);uiCfg.terrenos.ui={modelo:'sol',effort:'high'};
 const configFile=join(temp,'ui.json');writeFileSync(configFile,JSON.stringify(uiCfg));
 mkdirSync(join(temp,'scripts/loops'),{recursive:true});
 const marker=join(temp,'legacy-used');
 writeFileSync(join(temp,'scripts/loops/construcao-multillm.mjs'),"import {writeFileSync} from 'node:fs'; writeFileSync(process.env.LEGACY_MARKER,'used');");
 const ui=spawnSync('bash',[join(dir,'codex-run.sh'),'Implement the UI requested in the isolated fixture.'],{cwd:temp,env:{...process.env,HARNESS_CODEX_BIN:bin,HARNESS_RUNTIME_DIR:dir,HARNESS_DEFAULTS_FILE:configFile,HARNESS_LEDGER_FILE:join(temp,'ui-ledger.jsonl'),HARNESS_MARCOS_DIR:join(temp,'marcos'),LEDGER_TERRENO:'ui',LEDGER_PAPEL:'construtor',CODEX_TIMEOUT_MIN:'0',CODEX_CONSTRUCAO_CROSS_HARNESS:'1',ARGUMENT_FILE:join(temp,'ui-args.json'),LEGACY_MARKER:marker},encoding:'utf8',timeout:20000});
 assert.equal(ui.status,0,ui.stderr);assert.equal(existsSync(marker),false,'legacy bridge bypassed selected provider');
 assert.ok(readFileSync(join(temp,'ui-args.json'),'utf8').includes('gpt-5.6-sol'));

 const claudeCfg=structuredClone(cfg);claudeCfg.terrenos.ui={modelo:'fable',effort:'low',fallback_por_motivo:cfg.terrenos.rotina.fallback_por_motivo};
 const claudeCfgFile=join(temp,'claude.json');writeFileSync(claudeCfgFile,JSON.stringify(claudeCfg));
 const fakeClaude=join(temp,'fake-claude');
 writeFileSync(fakeClaude,`#!/usr/bin/env node\nconst fs=require('node:fs');fs.writeFileSync(process.env.CLAUDE_ARGUMENT_FILE,JSON.stringify(process.argv.slice(2)));fs.writeFileSync(process.env.CLAUDE_RANDOM_FILE,process.env.HARNESS_RANDOM||'');console.log(JSON.stringify({result:'DONE'}));\n`);chmodSync(fakeClaude,0o700);
 const claude=spawnSync('bash',[join(dir,'codex-run.sh'),'-m','opus','Build the user interface requested in this isolated fixture.'],{
  env:{...process.env,HARNESS_CODEX_BIN:bin,HARNESS_CLAUDE_WRAPPER:fakeClaude,HARNESS_RUNTIME_DIR:dir,
   HARNESS_DEFAULTS_FILE:claudeCfgFile,HARNESS_LEDGER_FILE:join(temp,'claude-ledger.jsonl'),
   HARNESS_MARCOS_DIR:join(temp,'marcos'),HARNESS_RANDOM:'0.1',LEDGER_TERRENO:'ui',LEDGER_PAPEL:'construtor',
   HARNESS_RANDOM:'',CLAUDE_ARGUMENT_FILE:join(temp,'claude-args.json'),CLAUDE_RANDOM_FILE:join(temp,'claude-random.txt')},encoding:'utf8',timeout:20000});
 assert.equal(claude.status,0,claude.stderr);
 const claudeArgs=JSON.parse(readFileSync(join(temp,'claude-args.json')));
 assert.equal(claudeArgs[claudeArgs.indexOf('--model')+1],'fable');
 const forwardedSeed=readFileSync(join(temp,'claude-random.txt'),'utf8');
 assert.ok(forwardedSeed && Number(forwardedSeed)>=0 && Number(forwardedSeed)<1);
 assert.equal(existsSync(join(temp,'ui-args.json')),true);
 const review=spawnSync('bash',[join(dir,'codex-run.sh'),'-m','fable','-c','model_reasoning_effort="low"',
  'Review this isolated fixture with a distinct author model.'],{
  env:{...process.env,HARNESS_CODEX_BIN:bin,HARNESS_CLAUDE_WRAPPER:fakeClaude,HARNESS_RUNTIME_DIR:dir,
   HARNESS_DEFAULTS_FILE:claudeCfgFile,HARNESS_MARCOS_DIR:join(temp,'marcos'),LEDGER_TERRENO:'ui',
   LEDGER_PAPEL:'revisor',LEDGER_MODELO_AUTOR:'sol',CLAUDE_ARGUMENT_FILE:join(temp,'review-args.json')},
  encoding:'utf8',timeout:20000});
 assert.equal(review.status,3);assert.match(review.stderr,/revisão Claude exige/);
 assert.equal(existsSync(join(temp,'review-args.json')),false);

});
