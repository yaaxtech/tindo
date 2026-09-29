import { versaoExperimento } from './rota-harness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { construirExperimentos, decidirExperimento } from './experimentos-harness.mjs';
const exp = { id: 'rotina-v1', ativo: true, base: 'a', bracos: [{id:'a',modelo:'sol',effort:'low'}, {id:'b',modelo:'luna',effort:'max'}] };
const defaults = {terrenos:{rotina:{experimento:exp}},codex:{terrenos:{rotina:{experimento:{...exp,id:'ignored'}}}}};
const row = {frente:'codex',terreno:'rotina',papel:'construtor',auto:true,experiment_version:versaoExperimento(exp),modelo_confirmado:true,experiment_id:exp.id,arm:'a',modelo:'gpt-5.6-sol',effort:'low',resultado:'ok1',session_id:'s1',dur:2};
test('assigned trials only; missing usage remains null and repeated session is not double counted', () => {
 const report=construirExperimentos(defaults,[row,{...row,experiment_id:undefined,session_id:'old'}],[]);
 assert.equal(report.experimentos[0].bracos[0].julgados,1);
 assert.equal(report.experimentos[0].bracos[0].tokens_mediana,null);
 const repeated=construirExperimentos(defaults,[row,{...row,arm:'b',modelo:'luna',effort:'max'}],[{session_id:'s1',tokens:50}]);
 assert.equal(repeated.experimentos[0].bracos[0].tokens_medidos,0);
 const shared=construirExperimentos(defaults,[row,{...row,frente:'claude',session_id:'other'}],[]);
 assert.equal(shared.experimentos.length,1);
 assert.equal(shared.experimentos[0].bracos[0].julgados,2);
});
test('small samples and missing telemetry cannot promote; strong complete evidence can', () => {
 const arm=(id,n,tokens)=>({id,julgados:n,ok1:n,falhas:0,tokens_medidos:n,modelos_confirmados:n,tokens_mediana:tokens,duracoes_medidas:n,duracao_mediana_min:1,pendentes:0});
 assert.equal(decidirExperimento({bracos:[arm('a',8,100),arm('b',8,50)]},exp).promover,null);
 assert.equal(decidirExperimento({bracos:[arm('a',100,100),arm('b',100,50)]},exp).promover,'b');
 assert.equal(decidirExperimento({bracos:[arm('a',100,100),{...arm('b',100,50),tokens_medidos:99}]},exp).promover,null);
 const baseRuim={...arm('a',100,100),ok1:50};
 assert.equal(decidirExperimento({bracos:[baseRuim,arm('b',100,150)]},exp).promover,'b');
});
