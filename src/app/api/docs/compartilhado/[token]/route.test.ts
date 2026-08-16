// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  documentoPublicoPorToken: vi.fn(),
}));

vi.mock('@/services/publico', () => ({
  documentoPublicoPorToken: mocks.documentoPublicoPorToken,
}));

import { GET } from './route';

function req() {
  return new Request('https://tindo.example/api/docs/compartilhado/tok-1');
}

describe('GET /api/docs/compartilhado/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('404 quando o token não devolve documento (restrito/inexistente)', async () => {
    mocks.documentoPublicoPorToken.mockResolvedValue(null);
    const resposta = await GET(req(), { params: Promise.resolve({ token: 'tok-1' }) });
    expect(resposta.status).toBe(404);
    expect(mocks.documentoPublicoPorToken).toHaveBeenCalledWith('tok-1');
  });

  it('devolve o documento público quando o token é válido', async () => {
    const documento = { raizId: 'r', titulo: 'Público', linhas: [{ id: 'r' }], espelhos: [] };
    mocks.documentoPublicoPorToken.mockResolvedValue(documento);
    const resposta = await GET(req(), { params: Promise.resolve({ token: 'tok-1' }) });
    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual(documento);
  });

  it('500 quando a leitura falha (não vaza detalhe interno)', async () => {
    mocks.documentoPublicoPorToken.mockRejectedValue(new Error('boom'));
    const resposta = await GET(req(), { params: Promise.resolve({ token: 'tok-1' }) });
    expect(resposta.status).toBe(500);
    await expect(resposta.json()).resolves.toEqual({
      erro: 'Não foi possível abrir este documento agora.',
      codigo: 'INTERNO',
    });
  });
});
