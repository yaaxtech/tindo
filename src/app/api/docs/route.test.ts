// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exigirContextoAuth: vi.fn(),
  garantirRaiz: vi.fn(),
  carregarDocumento: vi.fn(),
  carregarEspelhos: vi.fn(),
  salvarDocumento: vi.fn(),
}));

vi.mock('@/lib/auth/server', () => ({
  UsuarioNaoAutenticadoError: class UsuarioNaoAutenticadoError extends Error {
    readonly status = 401;
    constructor() {
      super('Entre na sua conta para continuar.');
    }
  },
  exigirContextoAuth: mocks.exigirContextoAuth,
}));

vi.mock('@/services/doc', () => ({
  garantirRaiz: mocks.garantirRaiz,
  carregarDocumento: mocks.carregarDocumento,
  carregarEspelhos: mocks.carregarEspelhos,
  salvarDocumento: mocks.salvarDocumento,
}));

import { UsuarioNaoAutenticadoError } from '@/lib/auth/server';
import { GET, PUT } from './route';

describe('/api/docs', () => {
  const contexto = { usuarioId: 'usuario-1', supabase: {}, email: 'pessoa@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exigirContextoAuth.mockResolvedValue(contexto);
    mocks.garantirRaiz.mockResolvedValue({ id: 'raiz' });
    mocks.carregarDocumento.mockResolvedValue([]);
    mocks.carregarEspelhos.mockResolvedValue([]);
  });

  it('responde 401 sem sessão e não consulta o documento', async () => {
    mocks.exigirContextoAuth.mockRejectedValue(new UsuarioNaoAutenticadoError());

    const resposta = await GET();

    expect(resposta.status).toBe(401);
    await expect(resposta.json()).resolves.toEqual({ erro: 'Entre na sua conta para continuar.' });
    expect(mocks.garantirRaiz).not.toHaveBeenCalled();
  });

  it('passa o mesmo contexto autenticado para todas as leituras', async () => {
    const resposta = await GET();

    expect(resposta.status).toBe(200);
    expect(mocks.garantirRaiz).toHaveBeenCalledWith(contexto);
    expect(mocks.carregarDocumento).toHaveBeenCalledWith(contexto);
    expect(mocks.carregarEspelhos).toHaveBeenCalledWith(contexto);
  });

  it('passa a sessão autenticada para a escrita', async () => {
    const linhas = [{ id: 'linha-1' }];
    const request = new Request('https://tindo.example/api/docs', {
      method: 'PUT',
      body: JSON.stringify({ raizId: 'raiz', linhas }),
    });

    const resposta = await PUT(request);

    expect(resposta.status).toBe(200);
    expect(mocks.salvarDocumento).toHaveBeenCalledWith(contexto, linhas, 'raiz');
  });
});
