// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroNaoEncontrado, ErroValidacao, MENSAGEM_ERRO_GENERICA } from './erros';
import { corpoJson, respostaErro, respostaOk, rotaApi } from './resposta';

function requisicao(corpo: string): Request {
  return new Request('https://tindo.example/api/teste', { method: 'POST', body: corpo });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('respostaOk', () => {
  it('devolve os dados como vieram', async () => {
    const resposta = respostaOk({ itens: [1, 2] });
    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({ itens: [1, 2] });
  });

  it('aceita status explícito (201 em criação)', () => {
    expect(respostaOk({ ok: true }, 201).status).toBe(201);
  });
});

describe('respostaErro', () => {
  it('usa o status e a mensagem do erro tipado', async () => {
    const resposta = respostaErro('GET /api/x', new ErroNaoEncontrado('Este acesso não existe.'));
    expect(resposta.status).toBe(404);
    await expect(resposta.json()).resolves.toEqual({
      erro: 'Este acesso não existe.',
      codigo: 'NAO_ENCONTRADO',
    });
  });

  it('erro desconhecido vira 500 genérico — o detalhe fica só no log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const interno = new Error('relation "tarefas" does not exist');
    const resposta = respostaErro('GET /api/x', interno);

    expect(resposta.status).toBe(500);
    await expect(resposta.json()).resolves.toEqual({
      erro: MENSAGEM_ERRO_GENERICA,
      codigo: 'INTERNO',
    });
    expect(log).toHaveBeenCalledWith('[GET /api/x]', interno);
  });

  it('4xx não polui o log do servidor', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    respostaErro('POST /api/x', new ErroValidacao('Informe um nome.'));
    expect(log).not.toHaveBeenCalled();
  });
});

describe('rotaApi', () => {
  it('deixa passar a resposta do caminho feliz', async () => {
    const GET = rotaApi('GET /api/x', async () => respostaOk({ ok: true }));
    const resposta = await GET();
    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({ ok: true });
  });

  it('converte o erro lançado pelo handler', async () => {
    const GET = rotaApi('GET /api/x', async () => {
      throw new ErroValidacao('documentoId é obrigatório.');
    });
    const resposta = await GET();
    expect(resposta.status).toBe(400);
    await expect(resposta.json()).resolves.toEqual({
      erro: 'documentoId é obrigatório.',
      codigo: 'VALIDACAO',
    });
  });

  it('repassa os argumentos do Next (request e params)', async () => {
    const POST = rotaApi(
      'POST /api/x/[id]',
      async (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
        respostaOk({ id: (await ctx.params).id }),
    );
    const resposta = await POST(requisicao('{}'), { params: Promise.resolve({ id: 'abc' }) });
    await expect(resposta.json()).resolves.toEqual({ id: 'abc' });
  });
});

describe('corpoJson', () => {
  it('lê um objeto JSON', async () => {
    await expect(corpoJson(requisicao('{"nome":"Ana"}'))).resolves.toEqual({ nome: 'Ana' });
  });

  it('corpo malformado vira 400 em vez de 500', async () => {
    const POST = rotaApi('POST /api/x', async (req: Request) => respostaOk(await corpoJson(req)));
    const resposta = await POST(requisicao('{nao é json'));
    expect(resposta.status).toBe(400);
    await expect(resposta.json()).resolves.toEqual({
      erro: 'Não foi possível ler os dados enviados.',
      codigo: 'CORPO_INVALIDO',
    });
  });

  it('JSON válido que não é objeto também é 400', async () => {
    const POST = rotaApi('POST /api/x', async (req: Request) => respostaOk(await corpoJson(req)));
    expect((await POST(requisicao('[1,2]'))).status).toBe(400);
    expect((await POST(requisicao('null'))).status).toBe(400);
  });
});
