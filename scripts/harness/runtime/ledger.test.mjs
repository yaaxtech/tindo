import test from 'node:test';
import assert from 'node:assert/strict';
import { calcKpis, familiaModelo, validarRevisaoCruzada } from './ledger.mjs';

const base = {
  ts: '2026-08-27T15:00:00.000Z',
  frente: 'codex',
  modelo: 'luna',
  effort: 'max',
  terreno: 'rotina',
  papel: 'construtor',
  papel_inferido: false,
};

test('descarte fica fora da qualidade geral e também do terreno', () => {
  const kpis = calcKpis([
    { ...base, resultado: 'ok1' },
    { ...base, resultado: 'descartado' },
  ]);
  assert.equal(kpis.ok1_pct, 1);
  assert.equal(kpis.reciclo_pct, 0);
  assert.equal(kpis.por_terreno.rotina.julgaveis, 1);
  assert.equal(kpis.por_terreno.rotina.reciclo, 0);
});

test('família de modelo ignora provider e versão', () => {
  assert.equal(familiaModelo('gpt-5.6-sol'), 'sol');
  assert.equal(familiaModelo('claude-opus-5'), 'opus');
});

test('revisor usa LLM diferente primeiro e própria somente como fallback', () => {
  assert.equal(
    validarRevisaoCruzada({ papel: 'revisor', modelo: 'gpt-5.6-sol' }).ok,
    false,
  );
  assert.equal(
    validarRevisaoCruzada({
      papel: 'revisor',
      modelo: 'gpt-5.6-sol',
      modeloAutor: 'gpt-5.6-sol',
    }).ok,
    false,
  );
  assert.deepEqual(
    validarRevisaoCruzada({
      papel: 'revisor',
      modelo: 'claude-opus-5',
      modeloAutor: 'gpt-5.6-sol',
    }),
    { ok: true, cruzada: true, autor: 'sol', revisor: 'opus' },
  );
  assert.deepEqual(
    validarRevisaoCruzada({
      papel: 'revisor',
      modelo: 'gpt-5.6-sol',
      modeloAutor: 'gpt-5.6-sol',
      fallbackProprio: true,
    }),
    {
      ok: true,
      cruzada: false,
      fallback_proprio: true,
      autor: 'sol',
      revisor: 'sol',
    },
  );
});
