import test from 'node:test';
import assert from 'node:assert/strict';
import { sortear } from './braco-experimental.mjs';

const defaultsFixture = {
  canary_ignored: {
    terrenos: {
      rotina: {
        effort_por_modelo: { astra: 'low' },
        braco_experimental_xhigh: { modelo: 'astra', effort: 'xhigh', amostragem: 0.2 },
      },
      sql: {
        effort_por_modelo: { astra: 'xhigh' },
        // sem braco_experimental_xhigh — sql já é xhigh, não recebe braço
      },
    },
  },
};
defaultsFixture.terrenos = defaultsFixture.canary_ignored.terrenos;
defaultsFixture.codex = { terrenos: { rotina: { modelo: 'luna', effort: 'max' } } };

test('rnd abaixo do limiar de amostragem sorteia o braço xhigh experimental', () => {
  assert.deepEqual(sortear('rotina', () => 0.05, defaultsFixture), {
    arm: 'xhigh_exp',
    effort: 'xhigh',
  });
});

test('rnd acima do limiar de amostragem sorteia o braço base (effort do terreno)', () => {
  assert.deepEqual(sortear('rotina', () => 0.5, defaultsFixture), {
    arm: 'base',
    effort: 'low',
  });
});

test('terreno sql (sem braço) sempre volta base, qualquer rnd', () => {
  assert.deepEqual(sortear('sql', () => 0, defaultsFixture), { arm: 'base', effort: 'xhigh' });
  assert.deepEqual(sortear('sql', () => 0.999, defaultsFixture), { arm: 'base', effort: 'xhigh' });
});

test('amostragem em N=1000 sorteios fica dentro de ±0.05 do valor configurado (0.2)', () => {
  let xhigh = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) {
    // gerador determinístico simples (LCG) em vez de Math.random — reprodutível
    const seed = (i * 9301 + 49297) % 233280;
    const rnd = () => seed / 233280;
    if (sortear('rotina', rnd, defaultsFixture).arm === 'xhigh_exp') xhigh++;
  }
  const proporcao = xhigh / N;
  assert.ok(
    Math.abs(proporcao - 0.2) <= 0.05,
    `proporção observada ${proporcao} fora de 0.2 ± 0.05`,
  );
});
