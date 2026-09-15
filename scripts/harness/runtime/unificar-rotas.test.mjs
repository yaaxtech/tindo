import test from 'node:test';
import assert from 'node:assert/strict';
import { unificarRotas } from './unificar-rotas.mjs';

test('migration keeps the common author and experiment, removes the second route, and is idempotent', () => {
  const original={_meta:{auto_aplicar:true},contas:{preservar:true},terrenos:{rotina:{modelo:'sol',effort:'low',fallback_por_motivo:{quota_openai:[{modelo:'sonnet',effort:'medium'}]}}},codex:{outra_config:true,terrenos:{rotina:{modelo:'luna',effort:'max',experimento:{id:'medido',ativo:true}}}}};
  const next=unificarRotas(original);
  assert.equal(next.terrenos.rotina.modelo,'sol');
  assert.equal(next.terrenos.rotina.experimento.id,'medido');
  assert.equal(next.codex.terrenos,undefined);
  assert.equal(next.codex.outra_config,true);
  assert.deepEqual(next.contas,original.contas);
  assert.deepEqual(next.terrenos.rotina.fallback_por_motivo.indisponivel_anthropic,[{modelo:'sol',effort:'low'}]);
  assert.deepEqual(unificarRotas(next),next);
  assert.ok(original.codex.terrenos);
});
