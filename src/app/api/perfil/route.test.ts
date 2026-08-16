// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exigirContextoAuth: vi.fn(),
  obterPerfil: vi.fn(),
  atualizarPerfil: vi.fn(),
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

vi.mock('@/services/perfil', () => ({
  obterPerfil: mocks.obterPerfil,
  atualizarPerfil: mocks.atualizarPerfil,
}));

import { UsuarioNaoAutenticadoError } from '@/lib/auth/server';
import { GET, PATCH } from './route';

describe('/api/perfil', () => {
  const contexto = { usuarioId: 'usuario-1', email: 'pessoa@example.com', supabase: {} };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exigirContextoAuth.mockResolvedValue(contexto);
  });

  it('não expõe perfil sem sessão', async () => {
    mocks.exigirContextoAuth.mockRejectedValue(new UsuarioNaoAutenticadoError());
    const resposta = await GET();
    expect(resposta.status).toBe(401);
    expect(mocks.obterPerfil).not.toHaveBeenCalled();
  });

  it('lê o perfil usando o contexto autenticado', async () => {
    mocks.obterPerfil.mockResolvedValue({ nome: 'Pessoa', cor: '#2CAF93' });
    const resposta = await GET();
    expect(resposta.status).toBe(200);
    expect(mocks.obterPerfil).toHaveBeenCalledWith(contexto);
  });

  it('edita somente o perfil da sessão', async () => {
    const entrada = { nome: 'Novo nome', whatsapp: '85999999999', cor: '#4C8DFF' };
    mocks.atualizarPerfil.mockResolvedValue(entrada);
    const resposta = await PATCH(
      new Request('https://tindo.example/api/perfil', {
        method: 'PATCH',
        body: JSON.stringify(entrada),
      }),
    );
    expect(resposta.status).toBe(200);
    expect(mocks.atualizarPerfil).toHaveBeenCalledWith(contexto, entrada);
  });
});
