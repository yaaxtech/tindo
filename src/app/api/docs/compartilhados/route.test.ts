// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exigirContextoAuth: vi.fn(),
  listarCompartilhadosComigo: vi.fn(),
  reconciliarConvitesPendentes: vi.fn(),
}));

// O dublê estende a classe REAL: se o mapeamento de status mudar, o teste
// acompanha em vez de dar falso verde com um Error solto.
vi.mock('@/lib/auth/server', async () => {
  const { ErroNaoAutenticado } = await import('@/lib/api/erros');
  return {
    UsuarioNaoAutenticadoError: class UsuarioNaoAutenticadoError extends ErroNaoAutenticado {},
    exigirContextoAuth: mocks.exigirContextoAuth,
  };
});

vi.mock('@/services/compartilhar', () => ({
  listarCompartilhadosComigo: mocks.listarCompartilhadosComigo,
  reconciliarConvitesPendentes: mocks.reconciliarConvitesPendentes,
}));

import { UsuarioNaoAutenticadoError } from '@/lib/auth/server';
import { GET } from './route';

describe('GET /api/docs/compartilhados', () => {
  const contexto = { usuarioId: 'guest-1', supabase: {}, email: 'g@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exigirContextoAuth.mockResolvedValue(contexto);
    mocks.listarCompartilhadosComigo.mockResolvedValue([]);
    mocks.reconciliarConvitesPendentes.mockResolvedValue(undefined);
  });

  it('responde 401 sem sessão e não consulta o serviço', async () => {
    mocks.exigirContextoAuth.mockRejectedValue(new UsuarioNaoAutenticadoError());
    const resposta = await GET();
    expect(resposta.status).toBe(401);
    expect(mocks.listarCompartilhadosComigo).not.toHaveBeenCalled();
    expect(mocks.reconciliarConvitesPendentes).not.toHaveBeenCalled();
  });

  it('devolve os itens compartilhados do usuário logado', async () => {
    const itens = [{ documentoId: 'doc-A', tituloMd: 'Plano', papel: 'leitor', dono: 'dono-1' }];
    mocks.listarCompartilhadosComigo.mockResolvedValue(itens);
    const resposta = await GET();
    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({ itens });
    expect(mocks.listarCompartilhadosComigo).toHaveBeenCalledWith(contexto);
  });

  it('roda a rede de segurança de reconciliação antes de listar', async () => {
    await GET();
    expect(mocks.reconciliarConvitesPendentes).toHaveBeenCalledWith(contexto);
  });
});
