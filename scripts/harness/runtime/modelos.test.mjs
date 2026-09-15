import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normModelo } from './modelos.mjs';

test('normModelo: nomes de tela com ESPAÇO colapsam no canônico', () => {
  assert.equal(normModelo('Opus 5'), 'opus-5');
  assert.equal(normModelo('Sonnet 5'), 'sonnet');
  assert.equal(normModelo('Fable 5.1'), 'fable-5.1');
});

test('normModelo: apelidos crus e prefixo codex/ colapsam no id gpt-5.6-*', () => {
  assert.equal(normModelo('sol'), 'gpt-5.6-sol');
  assert.equal(normModelo('terra'), 'gpt-5.6-terra');
  assert.equal(normModelo('luna'), 'gpt-5.6-luna');
  assert.equal(normModelo('codex/gpt-5.6-luna'), 'gpt-5.6-luna');
  assert.equal(normModelo('astra'), 'gpt-6-astra');
});

test('normModelo: idempotente no nome já canônico', () => {
  for (const m of ['gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-6-astra', 'opus-5', 'fable-5.1']) {
    assert.equal(normModelo(m), m);
  }
});

test('normModelo: NÃO funde modelos genuinamente diferentes', () => {
  assert.equal(normModelo('opus-5'), 'opus-5');
  assert.equal(normModelo('opus-4.8'), 'opus-4.8');
  assert.notEqual(normModelo('opus-5'), normModelo('opus-4.8'));
  assert.equal(normModelo('fable'), 'fable'); // Fable 5, ≠ Fable 5.1
  assert.notEqual(normModelo('fable'), normModelo('fable-5.1'));
});

test('normModelo: não-modelos passam intactos', () => {
  for (const m of ['gpt-5.6-codex', 'codex', 'codex-config-default', 'explorer']) {
    assert.equal(normModelo(m), m);
  }
});
