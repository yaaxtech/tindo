// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarClienteClaude, fetchNativo } from './cliente-claude';

afterEach(() => vi.unstubAllGlobals());

describe('cliente Claude', () => {
  it('usa o fetch nativo e descarta o agent do shim de Node', async () => {
    const nativo = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', nativo);
    // biome-ignore lint/suspicious/noExplicitAny: assinatura do Fetch do SDK
    await (fetchNativo as any)('https://api.anthropic.com/x', { method: 'POST', agent: {} });
    expect(nativo).toHaveBeenCalledWith('https://api.anthropic.com/x', { method: 'POST' });
  });

  it('as chamadas do SDK passam pelo fetch nativo', async () => {
    const nativo = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'm',
            type: 'message',
            role: 'assistant',
            model: 'x',
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', nativo);
    const r = await criarClienteClaude('sk-ant-teste').messages.create({
      model: 'x',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'oi' }],
    });
    expect(nativo).toHaveBeenCalledTimes(1);
    expect(r.content[0]).toEqual({ type: 'text', text: 'ok' });
  });
});
