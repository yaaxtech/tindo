import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdtempSync,chmodSync,mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolverRota,versaoExperimento } from './rota-harness.mjs';
import { executarDespacho } from './despachar-harness.mjs';
import { reciboEventos } from './codex-eventos.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const cfg=JSON.parse(readFileSync(join(dir,'defaults-terreno.example.json'),'utf8'));
test('stale explicit flags cannot bypass the configured default or random assignment',()=>{
 const a=resolverRota({defaults:cfg,terreno:'rotina',modelo:'gpt-6-astra',effort:'xhigh',random:()=>0.1});
 assert.equal(a.modelo_cli,'gpt-5.6-sol');assert.equal(a.effort,'low');assert.equal(a.arm,'sol-low');
 const b=resolverRota({defaults:cfg,terreno:'rotina',random:()=>0.9});assert.equal(b.modelo_cli,'gpt-5.6-luna');assert.equal(b.arm,'luna-max');
 assert.throws(()=>resolverRota({defaults:cfg,terreno:'unknown'}),/desconhecido/);
 const sql=resolverRota({defaults:cfg,terreno:'sql',fallbackMotivo:'quota_openai'});
 assert.equal(sql.provider,'claude');assert.equal(sql.effort,'high');assert.equal(sql.experiment_id,null);
});
test('quota switches provider once; ordinary failure never repeats',()=>{
 const calls=[];
 const r=executarDespacho({terreno:'sql',defaults:cfg,prompt:'prepare local SQL',invocar:rota=>{
  calls.push(rota.provider);return rota.provider==='codex'?{status:1,stderr:'usage limit'}:{status:0,stdout:'ok'};
 }});
 assert.equal(r.ok,true);assert.deepEqual(calls,['codex','claude']);
 let n=0;executarDespacho({terreno:'rotina',defaults:cfg,prompt:'code',invocar:()=>{n++;return {status:1,stderr:'syntax error'};}});assert.equal(n,1);
});
test('session receipt belongs to this process, not latest concurrent file',()=>{
 assert.deepEqual(reciboEventos('{"type":"thread.started","thread_id":"abc"}\n{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":80,"output_tokens":20}}'),{session_id:'abc',tokens:120});
 assert.equal(reciboEventos('{"type":"thread.started","thread_id":"a"}\n{"type":"thread.started","thread_id":"b"}').session_id,null);
});
test('fake executor proves effective arguments -> output -> ledger trial metadata',()=>{
 const temp=mkdtempSync(join(tmpdir(),'harness-launcher-'));
 const bin=join(temp,'fake-codex');const ledger=join(temp,'ledger.jsonl');
 writeFileSync(bin,`#!/usr/bin/env node\nconst fs=require('node:fs');fs.writeFileSync(process.env.ARGUMENT_FILE,JSON.stringify(process.argv.slice(2)));console.log(JSON.stringify({type:'thread.started',thread_id:'fixture-session'}));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'DONE'}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:100,output_tokens:20}}));\n`);chmodSync(bin,0o700);mkdirSync(join(temp,'marcos'));
 const r=spawnSync('bash',[join(dir,'codex-run.sh'),'-m','gpt-6-astra','-c','model_reasoning_effort="xhigh"','Implement a pure sum function in this temporary test fixture.'],{
  env:{...process.env,HARNESS_CODEX_BIN:bin,HARNESS_RUNTIME_DIR:dir,HARNESS_DEFAULTS_FILE:join(dir,'defaults-terreno.example.json'),HARNESS_LEDGER_FILE:ledger,HARNESS_MARCOS_DIR:join(temp,'marcos'),HARNESS_RANDOM:'0.1',LEDGER_TERRENO:'rotina',LEDGER_PAPEL:'construtor',CODEX_TIMEOUT_MIN:'0',CODEX_CONSTRUCAO_CROSS_HARNESS:'0',ARGUMENT_FILE:join(temp,'args.json')},encoding:'utf8',timeout:20000});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/DONE/);
 const argv=JSON.parse(readFileSync(join(temp,'args.json')));assert.equal(argv[argv.indexOf('-m')+1],'gpt-5.6-sol');assert.ok(argv.includes('model_reasoning_effort="low"'));
 const row=JSON.parse(readFileSync(ledger,'utf8').trim());assert.equal(row.modelo,'gpt-5.6-sol');assert.equal(row.arm,'sol-low');assert.equal(row.session_id,'fixture-session');assert.equal(row.tokens,120);assert.equal(row.classificacao,'declarada');assert.equal(row.experiment_version,versaoExperimento(cfg.codex.terrenos.rotina.experimento));
});
