import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { descreverFalhaIA } from './falha-ia';

function erroApi(status: number, mensagem: string) {
  return Anthropic.APIError.generate(
    status,
    { type: 'error', error: { type: 'x', message: mensagem } },
    mensagem,
    undefined,
  );
}

describe('descreverFalhaIA', () => {
  it('chave recusada para tudo e aponta Configurações', () => {
    const f = descreverFalhaIA(erroApi(401, 'invalid x-api-key'));
    expect(f.geral).toBe(true);
    expect(f.mensagem).toContain('chave');
  });

  it('reconhece falta de crédito', () => {
    const f = descreverFalhaIA(
      erroApi(400, 'Your credit balance is too low to access the Anthropic API.'),
    );
    expect(f).toEqual({ mensagem: expect.stringContaining('sem créditos'), geral: true });
  });

  it('mostra o motivo de outro pedido recusado', () => {
    const f = descreverFalhaIA(erroApi(400, 'tools.0.input_schema: invalid'));
    expect(f.geral).toBe(true);
    expect(f.mensagem).toContain('tools.0.input_schema');
  });

  it('modelo inexistente para tudo', () => {
    expect(descreverFalhaIA(erroApi(404, 'model: x')).geral).toBe(true);
  });

  it('erro qualquer fica só no item', () => {
    expect(descreverFalhaIA(new Error('boom'))).toEqual({
      mensagem: 'A IA não conseguiu classificar.',
      geral: false,
    });
  });
});
