import { describe, expect, it, vi } from 'vitest';
import {
  type ServerSupabaseClient,
  UsuarioNaoAutenticadoError,
  exigirContextoAuth,
  obterContextoAuth,
} from './server';

function clienteComClaims(resultado: unknown): ServerSupabaseClient {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue(resultado),
    },
  } as unknown as ServerSupabaseClient;
}

describe('obterContextoAuth', () => {
  it('retorna a identidade validada e o mesmo cliente', async () => {
    const client = clienteComClaims({
      data: {
        claims: {
          sub: 'usuario-1',
          email: 'pessoa@example.com',
          role: 'authenticated',
          is_anonymous: false,
        },
      },
      error: null,
    });

    await expect(obterContextoAuth(client)).resolves.toEqual({
      supabase: client,
      usuarioId: 'usuario-1',
      email: 'pessoa@example.com',
    });
  });

  it.each([
    { data: null, error: null },
    { data: null, error: new Error('token inválido') },
    { data: { claims: { role: 'authenticated' } }, error: null },
    { data: { claims: { sub: 'anon', role: 'authenticated', is_anonymous: true } }, error: null },
    { data: { claims: { sub: 'service', role: 'service_role' } }, error: null },
  ])('falha fechada para sessão ausente ou não autenticada', async (resultado) => {
    await expect(obterContextoAuth(clienteComClaims(resultado))).resolves.toBeNull();
  });
});

describe('exigirContextoAuth', () => {
  it('lança erro HTTP 401 tipado sem sessão válida', async () => {
    const promise = exigirContextoAuth(clienteComClaims({ data: null, error: null }));

    await expect(promise).rejects.toBeInstanceOf(UsuarioNaoAutenticadoError);
    await expect(promise).rejects.toMatchObject({ code: 'NAO_AUTENTICADO', status: 401 });
  });
});
