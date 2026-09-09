import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { analisarTranscript } from './janela.mjs';

test('contexto Claude respeita timestamps e conta cada mensagem uma vez', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'harness-janela-'));
  const file = join(dir, 'fixture.jsonl');
  const linha = (timestamp, id, output = 10) => ({
    timestamp,
    type: 'assistant',
    message: {
      id,
      model: 'modelo-fixture',
      usage: {
        input_tokens: 50,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 5,
        output_tokens: output,
      },
      content: [],
    },
  });
  await writeFile(
    file,
    [
      linha('2026-08-01T00:00:00Z', 'antiga'),
      linha('2026-09-08T00:00:00Z', 'nova'),
      linha('2026-09-08T00:00:01Z', 'nova', 20),
      linha('2026-09-10T00:00:00Z', 'futura'),
    ]
      .map(JSON.stringify)
      .join('\n'),
  );
  try {
    const r = await analisarTranscript(file, {
      limite: Date.parse('2026-09-02T00:00:00Z'),
      agora: Date.parse('2026-09-09T00:00:00Z'),
    });
    assert.equal(r.chamadas, 1);
    assert.equal(r.tokens, 175);
    assert.equal(r.cacheRead, 100);
    assert.equal(r.pico_contexto, 155);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('une cópias da sessão preservando continuação e deduplicando compact e ferramentas', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'harness-copias-'));
  const mensagem = (id, timestamp) => ({
    timestamp,
    type: 'assistant',
    message: {
      id,
      model: 'fixture',
      usage: { input_tokens: 100, output_tokens: 10 },
      content: [
        {
          type: 'tool_use',
          id: `tool-${id}`,
          name: 'Agent',
          input: { text: 'unicode\u2028válido\u2029' },
        },
      ],
    },
  });
  const compact = {
    timestamp: '2026-09-08T01:00:00Z',
    subtype: 'compact_boundary',
    uuid: 'compact-1',
  };
  const a = join(dir, 'a.jsonl');
  const b = join(dir, 'b.jsonl');
  const comum = mensagem('comum', '2026-09-08T00:00:00Z');
  try {
    await writeFile(a, [comum, compact].map(JSON.stringify).join('\r\n'));
    await writeFile(
      b,
      [comum, compact, mensagem('nova', '2026-09-08T02:00:00Z')].map(JSON.stringify).join('\n'),
    );
    const r = await analisarTranscript([b, a], { agora: Date.parse('2026-09-09T00:00:00Z') });
    assert.equal(r.chamadas, 2);
    assert.equal(r.tokens, 220);
    assert.equal(r.compacts, 1);
    assert.equal(r.subagentes, 2);
  } finally {
    await rm(dir, { recursive: true });
  }
});
