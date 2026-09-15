import assert from 'node:assert/strict';
import test from 'node:test';
import { normModelo } from './modelos.mjs';
test('aliases explícitos de Fable 5.1 convergem sem adivinhar versão do genérico', () => {
  assert.equal(normModelo('claude-fable-5-1'), 'fable-5.1');
  assert.equal(normModelo('fable-5.1'), 'fable-5.1');
  assert.equal(normModelo('fable'), 'fable');
});

test('prefixo Kimi não fragmenta versão explícita, sem fundir contextos desconhecidos', () => {
  assert.equal(normModelo('kimi-code/k3-256k'), 'k3-256k');
  assert.equal(normModelo('k3-256k'), 'k3-256k');
  assert.equal(normModelo('kimi-code/k3'), 'k3');
});

// Aliases emitted by resolver and CLI share one measured model.
test('normaliza os aliases Codex sem confundir versões', () => {
  assert.equal(normModelo('sol'), 'gpt-5.6-sol');
  assert.equal(normModelo('luna'), 'gpt-5.6-luna');
  assert.equal(normModelo('astra'), 'gpt-6-astra');
  assert.equal(normModelo('gpt-6-astra'), 'gpt-6-astra');
});
