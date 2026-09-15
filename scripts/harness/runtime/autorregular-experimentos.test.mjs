import { versaoExperimento } from './rota-harness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { autorregular } from './autorregular-experimentos.mjs';
test('no mutation without evidence; complete trial changes real default once and leaves rollback receipt',()=>{
 const dir=mkdtempSync(join(tmpdir(),'harness-auto-'));
 const defaultsFile=join(dir,'defaults.json'),auditFile=join(dir,'audit.jsonl');
 const cfg={_meta:{auto_aplicar:true,governanca:'experimentos-v1'},terrenos:{rotina:{modelo:'sol',effort:'low',experimento:{id:'test-v1',ativo:true,base:'a',bracos:[{id:'a',modelo:'sol',effort:'low'},{id:'b',modelo:'luna',effort:'max'}]}}},codex:{terrenos:{rotina:{modelo:'astra',effort:'xhigh'}}}};
 writeFileSync(defaultsFile,JSON.stringify(cfg));
 const linhas=[],sessoes=[];
 for(const [arm,modelo,effort,tokens] of [['a','sol','low',100],['b','luna','max',50]])for(let i=0;i<100;i++){
  const session_id=`${arm}-${i}`;sessoes.push({session_id,tokens});
  linhas.push({frente:i%2?'claude':'codex',terreno:'rotina',papel:'construtor',auto:true,experiment_version:versaoExperimento(cfg.terrenos.rotina.experimento),modelo_confirmado:true,experiment_id:'test-v1',arm,modelo,effort,resultado:'ok1',session_id,dur:1});
 }
 assert.equal(autorregular({defaultsFile,auditFile,linhas:[],sessoes:[],aplicar:true}).mudancas.length,0);
 assert.equal(autorregular({defaultsFile,auditFile,linhas,sessoes,aplicar:false}).mudancas.length,0);
 assert.equal(autorregular({defaultsFile,auditFile,linhas,sessoes,aplicar:true}).mudancas.length,1);
 assert.equal(JSON.parse(readFileSync(defaultsFile)).terrenos.rotina.modelo,'luna');
 assert.equal(JSON.parse(readFileSync(defaultsFile)).codex.terrenos.rotina.modelo,'astra');
 const novo=JSON.parse(readFileSync(defaultsFile)).terrenos.rotina.experimento;
 assert.equal(novo.ativo,true);assert.equal(novo.base,'b');assert.equal(novo.ciclo,2);
 assert.equal(novo.historico[0].bracos[0].julgados,100);
 assert.equal(autorregular({defaultsFile,auditFile,linhas,sessoes,aplicar:true}).mudancas.length,0);
 assert.match(readFileSync(auditFile,'utf8'),/promoveu_experimento/);
});
