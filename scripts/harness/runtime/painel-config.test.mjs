import test from 'node:test';
import assert from 'node:assert/strict';
import { construirCadeias, ASSINATURAS } from './painel-config.mjs';
test('changing the active author selects that authors reviewer and effort', () => {
  const route = { rotulo:'UI', modelo:'fable', effort:'low', piso_modelo:'sol', teto_modelo:'fable',
    fallback_por_motivo:{qualidade:[{modelo:'sol',effort:'high'}]},
    revisao_por_modelo:{fable:[{modelo:'sol',effort:'high'}],sol:[{modelo:'opus5',effort:'high'}]} };
  const defaults = {terrenos:{ui:route}};
  assert.match(construirCadeias(defaults).ui.revisor,/Sol \(high\) revisa Fable 5 \(low\)/);
  route.modelo='sol';route.effort='high';
  const next=construirCadeias(defaults).ui;
  assert.match(next.revisor,/Opus 5 \(high\) revisa Sol \(high\)/);
  assert.equal(next.default,'Sol (high)');
  assert.equal(next.piso,true);
});
test('absent reviewer and empty fallback do not invent authorized routes', () => {
  const x=construirCadeias({terrenos:{sql:{modelo:'opus5',effort:'high',fallback_por_motivo:{opus_indisponivel:[]}}}}).sql;
  assert.match(x.revisor,/não definido/);
  assert.match(x.fallback[0],/sem substituto autorizado/);
});
test('both active subscriptions keep unknown renewal separate from purchase date', () => {
  assert.deepEqual(ASSINATURAS.map(a=>a.frente),['codex','claude']);
  assert.ok(ASSINATURAS.every(a=>a.renova==='não informada'));
  assert.equal(ASSINATURAS.reduce((s,a)=>s+a.valor,0),300);
});

test('legacy model lock flag describes a fixed range, not current position', () => {
  const d={modelo:'fable',effort:'high',piso_modelo:'sol',teto_modelo:'fable'};
  assert.equal(construirCadeias({terrenos:{ui:d}}).ui.modelo_no_teto,false);
  d.piso_modelo='fable';
  assert.equal(construirCadeias({terrenos:{ui:d}}).ui.modelo_no_teto,true);
});
test('invalid route cannot publish an invented fallback', () => {
  assert.throws(()=>construirCadeias({terrenos:{ui:{modelo:'fable',effort:'low',fallback_por_motivo:{qualidade:null}}}}),/Fallback inválido/);
  assert.throws(()=>construirCadeias({terrenos:{ui:{}}}),/sem titular/);
});

test('preserves all six legacy KPI piso values independently of active model', () => {
  const expected={rotina:true,dificil:false,analise:false,ui:true,mecanico:true,sql:false};
  const terrenos=Object.fromEntries(Object.keys(expected).map(k=>[k,{modelo:'sol',effort:'high',piso_modelo:'sol',teto_modelo:'sol'}]));
  assert.deepEqual(Object.fromEntries(Object.entries(construirCadeias({terrenos})).map(([k,v])=>[k,v.piso])),expected);
});
