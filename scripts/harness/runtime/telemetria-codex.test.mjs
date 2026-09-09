import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { coletarTelemetriaCodex } from './telemetria-codex.mjs';

const AGORA = Date.parse('2026-09-09T12:00:00.000Z');

function linha(timestamp, ordinal, payload, type = 'event_msg') {
  return JSON.stringify({ timestamp, ordinal, type, payload });
}

async function comFixture(linhas, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'telemetria-codex-'));
  try {
    await writeFile(join(dir, 'sessao.jsonl'), `${linhas.join('\n')}\n`);
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function comArquivosFixture(arquivos, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'telemetria-codex-'));
  try {
    await Promise.all(
      Object.entries(arquivos).map(([nome, linhas]) =>
        writeFile(join(dir, nome), `${linhas.join('\n')}\n`),
      ),
    );
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('soma deltas cumulativos uma vez e associa cada chamada ao turn_context', async () => {
  const resultado = await comFixture(
    [
      linha(
        '2026-09-01T10:00:00.000Z',
        0,
        {
          type: 'session_meta',
          session_id: 'sessao-1',
          id: 'fluxo-1',
        },
        'session_meta',
      ),
      linha(
        '2026-09-01T10:00:01.000Z',
        1,
        {
          type: 'turn_context',
          turn_id: 'turno-1',
          model: 'gpt-6-astra',
        },
        'turn_context',
      ),
      linha('2026-09-01T10:00:02.000Z', 2, {
        type: 'token_count',
        info: {
          total_token_usage: {
            total_tokens: 100,
            input_tokens: 80,
            cached_input_tokens: 20,
            output_tokens: 20,
          },
        },
      }),
      linha('2026-09-01T10:00:03.000Z', 3, {
        type: 'token_count',
        info: {
          total_token_usage: {
            total_tokens: 150,
            input_tokens: 120,
            cached_input_tokens: 30,
            output_tokens: 30,
          },
        },
      }),
      linha('2026-09-01T10:00:03.000Z', 3, {
        type: 'token_count',
        info: {
          total_token_usage: {
            total_tokens: 150,
            input_tokens: 120,
            cached_input_tokens: 30,
            output_tokens: 30,
          },
        },
      }),
      linha(
        '2026-09-01T10:00:04.000Z',
        4,
        {
          type: 'turn_context',
          turn_id: 'turno-2',
          model: 'gpt-5.6-sol',
        },
        'turn_context',
      ),
      linha('2026-09-01T10:00:05.000Z', 5, {
        type: 'token_count',
        info: {
          total_token_usage: {
            total_tokens: 180,
            input_tokens: 140,
            cached_input_tokens: 40,
            output_tokens: 40,
          },
        },
      }),
    ],
    async (dir) => coletarTelemetriaCodex({ dias: 14, agora: AGORA, dirs: [dir] }),
  );

  assert.equal(resultado.chamadas, 3);
  assert.equal(resultado.tokens, 180);
  assert.equal(resultado.input, 140);
  assert.equal(resultado.cache_read, 40);
  assert.equal(resultado.output, 40);
  assert.deepEqual(resultado.por_modelo, [
    { modelo: 'gpt-6-astra', tokens: 150, chamadas: 2 },
    { modelo: 'gpt-5.6-sol', tokens: 30, chamadas: 1 },
  ]);
});

test('usa o snapshot anterior ao corte para não cobrar gasto acumulado anterior', async () => {
  const resultado = await comFixture(
    [
      linha(
        '2026-08-20T10:00:00.000Z',
        0,
        {
          type: 'session_meta',
          session_id: 'sessao-2',
          id: 'fluxo-2',
        },
        'session_meta',
      ),
      linha(
        '2026-08-20T10:00:01.000Z',
        1,
        {
          type: 'turn_context',
          turn_id: 'turno-1',
          model: 'gpt-6-astra',
        },
        'turn_context',
      ),
      linha('2026-08-20T10:00:02.000Z', 2, {
        type: 'token_count',
        info: {
          total_token_usage: {
            total_tokens: 900,
            input_tokens: 700,
            cached_input_tokens: 600,
            output_tokens: 200,
          },
        },
      }),
      linha('2026-09-08T10:00:02.000Z', 3, {
        type: 'token_count',
        info: {
          total_token_usage: {
            total_tokens: 1_000,
            input_tokens: 780,
            cached_input_tokens: 650,
            output_tokens: 220,
          },
        },
      }),
    ],
    async (dir) => coletarTelemetriaCodex({ dias: 2, agora: AGORA, dirs: [dir] }),
  );

  assert.equal(resultado.chamadas, 1);
  assert.equal(resultado.tokens, 100);
  assert.equal(resultado.input, 80);
  assert.equal(resultado.cache_read, 50);
  assert.equal(resultado.output, 20);
});

test('deduplica cópia ativa/arquivada e mantém fork identificável na mesma sessão', async () => {
  const raiz = [
    linha(
      '2026-09-08T08:00:00.000Z',
      0,
      {
        type: 'session_meta',
        session_id: 'sessao-raiz',
        id: 'fluxo-raiz',
      },
      'session_meta',
    ),
    linha(
      '2026-09-08T08:00:01.000Z',
      1,
      {
        type: 'turn_context',
        turn_id: 'turno-raiz',
        model: 'gpt-6-astra',
      },
      'turn_context',
    ),
    linha('2026-09-08T08:00:02.000Z', 2, {
      type: 'token_count',
      info: {
        total_token_usage: {
          total_tokens: 100,
          input_tokens: 80,
          cached_input_tokens: 20,
          output_tokens: 20,
        },
      },
    }),
    linha('2026-09-08T08:00:03.000Z', 3, {
      type: 'token_count',
      info: {
        total_token_usage: {
          total_tokens: 200,
          input_tokens: 160,
          cached_input_tokens: 40,
          output_tokens: 40,
        },
      },
    }),
  ];
  const fork = [
    linha(
      '2026-09-08T08:01:00.000Z',
      0,
      {
        type: 'session_meta',
        session_id: 'sessao-raiz',
        id: 'fluxo-fork',
        parent_thread_id: 'sessao-raiz',
      },
      'session_meta',
    ),
    linha(
      '2026-09-08T08:01:01.000Z',
      1,
      {
        type: 'turn_context',
        turn_id: 'turno-fork',
        model: 'gpt-5.6-luna',
      },
      'turn_context',
    ),
    linha('2026-09-08T08:01:02.000Z', 2, {
      type: 'token_count',
      info: {
        total_token_usage: {
          total_tokens: 50,
          input_tokens: 40,
          cached_input_tokens: 0,
          output_tokens: 10,
        },
      },
    }),
    linha('2026-09-08T08:01:03.000Z', 3, {
      type: 'token_count',
      info: {
        total_token_usage: {
          total_tokens: 80,
          input_tokens: 60,
          cached_input_tokens: 0,
          output_tokens: 20,
        },
      },
    }),
  ];
  const resultado = await comArquivosFixture(
    {
      'ativo.jsonl': raiz,
      'arquivado.jsonl': raiz,
      'fork.jsonl': fork,
    },
    async (dir) => coletarTelemetriaCodex({ dias: 2, agora: AGORA, dirs: [dir] }),
  );

  assert.equal(resultado.sessoes, 1);
  assert.equal(resultado.chamadas, 4);
  assert.equal(resultado.tokens, 280);
  assert.deepEqual(resultado.por_modelo, [
    { modelo: 'gpt-6-astra', tokens: 200, chamadas: 2 },
    { modelo: 'gpt-5.6-luna', tokens: 80, chamadas: 2 },
  ]);
});

test('reduz modelo ausente ou não plausível a identificador desconhecido', async () => {
  const resultado = await comFixture(
    [
      linha(
        '2026-09-08T13:00:00.000Z',
        0,
        {
          type: 'session_meta',
          session_id: 'sessao-modelo',
          id: 'fluxo-modelo',
        },
        'session_meta',
      ),
      linha(
        '2026-09-08T13:00:01.000Z',
        1,
        {
          type: 'turn_context',
          turn_id: 'turno-modelo',
          model: '/Users/privado/segredo',
        },
        'turn_context',
      ),
      linha('2026-09-08T13:00:02.000Z', 2, {
        type: 'token_count',
        info: {
          total_token_usage: {
            total_tokens: 10,
            input_tokens: 8,
            cached_input_tokens: 0,
            output_tokens: 2,
          },
        },
      }),
    ],
    async (dir) => coletarTelemetriaCodex({ dias: 2, agora: AGORA, dirs: [dir] }),
  );

  assert.deepEqual(resultado.por_modelo, [{ modelo: 'desconhecido', tokens: 10, chamadas: 1 }]);
});

test('não conta sessão sem atividade dentro da janela', async () => {
  const resultado = await comFixture(
    [
      linha(
        '2026-08-20T13:00:00.000Z',
        0,
        {
          type: 'session_meta',
          session_id: 'sessao-antiga',
          id: 'fluxo-antigo',
        },
        'session_meta',
      ),
      linha(
        '2026-08-20T13:00:01.000Z',
        1,
        {
          type: 'turn_context',
          turn_id: 'turno-antigo',
          model: 'gpt-6-astra',
        },
        'turn_context',
      ),
      linha('2026-08-20T13:00:02.000Z', 2, {
        type: 'token_count',
        info: {
          total_token_usage: {
            total_tokens: 500,
            input_tokens: 450,
            cached_input_tokens: 400,
            output_tokens: 50,
          },
        },
      }),
      linha(
        '2026-08-20T13:00:03.000Z',
        3,
        {
          type: 'function_call',
          name: 'request_user_input',
          call_id: 'pergunta-antiga',
          arguments: JSON.stringify({ questions: [{ id: 'antiga' }] }),
        },
        'response_item',
      ),
    ],
    async (dir) => coletarTelemetriaCodex({ dias: 2, agora: AGORA, dirs: [dir] }),
  );

  assert.equal(resultado.sessoes, 0);
  assert.equal(resultado.chamadas, 0);
  assert.equal(resultado.tokens, 0);
});

test('conta perguntas estruturais, respostas pareadas e pendências por dia', async () => {
  const resultado = await comFixture(
    [
      linha(
        '2026-09-08T09:00:00.000Z',
        0,
        {
          type: 'session_meta',
          session_id: 'sessao-3',
          id: 'fluxo-3',
        },
        'session_meta',
      ),
      linha(
        '2026-09-08T09:00:01.000Z',
        1,
        {
          type: 'function_call',
          name: 'request_user_input_async',
          call_id: 'call-1',
          arguments: JSON.stringify({ questions: [{ title: 'A', options: [] }, { title: 'B' }] }),
        },
        'function_call',
      ),
      linha(
        '2026-09-08T09:00:02.000Z',
        2,
        {
          type: 'function_call_output',
          call_id: 'call-1',
          output: JSON.stringify({ accepted: true }),
        },
        'function_call_output',
      ),
      linha(
        '2026-09-08T10:00:00.000Z',
        3,
        {
          type: 'custom_tool_call',
          name: 'request_user_input',
          call_id: 'call-2',
          input: JSON.stringify({ questions: [{ title: 'C' }] }),
        },
        'custom_tool_call',
      ),
      linha(
        '2026-09-08T10:00:01.000Z',
        4,
        {
          type: 'custom_tool_call_output',
          call_id: 'call-2',
          output: JSON.stringify({ answers: {} }),
        },
        'custom_tool_call_output',
      ),
      linha(
        '2026-09-08T11:00:00.000Z',
        5,
        {
          type: 'custom_tool_call',
          name: 'exec',
          input: {
            calls: [
              {
                name: 'request_user_input_async',
                call_id: 'call-3',
                arguments: {
                  questions: [{ title: 'D' }],
                },
              },
            ],
          },
        },
        'custom_tool_call',
      ),
      linha(
        '2026-09-08T11:00:01.000Z',
        6,
        {
          type: 'custom_tool_call_output',
          call_id: 'call-3',
          output: JSON.stringify({ answers: { D: 'opção' } }),
        },
        'custom_tool_call_output',
      ),
      linha(
        '2026-09-08T12:00:00.000Z',
        7,
        {
          type: 'custom_tool_call',
          name: 'exec',
          input: 'texto de conversa com request_user_input_async',
        },
        'custom_tool_call',
      ),
    ],
    async (dir) => coletarTelemetriaCodex({ dias: 2, agora: AGORA, dirs: [dir] }),
  );

  assert.deepEqual(resultado.perguntas_por_dia, [
    {
      data: '2026-09-08',
      perguntas: 4,
      respondidas: 1,
      pendentes: 3,
    },
  ]);
  assert.deepEqual(resultado.cobertura_perguntas, {
    metodo: 'estrutural',
    functions_exec: 'somente_payload_estruturado',
  });
});

test('preserva separadores Unicode dentro de JSON válido em todos os runtimes', async () => {
  const resultado = await comFixture(
    [
      linha(
        '2026-09-08T00:00:00Z',
        0,
        { type: 'session_meta', id: 'unicode', text: 'a\u2028b\u2029c' },
        'session_meta',
      ),
      linha('2026-09-08T00:00:01Z', 1, {
        type: 'token_count',
        info: { total_token_usage: { total_tokens: 100, input_tokens: 80, output_tokens: 20 } },
      }),
    ],
    (dir) => coletarTelemetriaCodex({ dirs: [dir], agora: AGORA, dias: 14 }),
  );
  assert.equal(resultado.erros_leitura, 0);
  assert.equal(resultado.tokens, 100);
  assert.equal(resultado.sessoes, 1);
});
