import { describe, expect, it, vi } from 'vitest';
import {
  ErroDeAutenticacao,
  entrarComSenha,
  enviarLinkMagico,
  solicitarRecuperacaoDeSenha,
  urlDeCallback,
} from './auth';

function clienteAuth() {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

describe('serviço de autenticação', () => {
  it('monta callback somente com destino interno', () => {
    expect(urlDeCallback('/docs?doc=123', 'https://tindo.example')).toBe(
      'https://tindo.example/auth/callback?next=%2Fdocs%3Fdoc%3D123',
    );
    expect(urlDeCallback('//evil.example', 'https://tindo.example')).toBe(
      'https://tindo.example/auth/callback?next=%2Fdocs',
    );
  });

  it('não cria usuário ao pedir link mágico', async () => {
    const supabase = clienteAuth();
    await enviarLinkMagico(' pessoa@example.com ', '/docs', 'captcha', supabase as never);
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'pessoa@example.com',
      options: expect.objectContaining({ shouldCreateUser: false, captchaToken: 'captcha' }),
    });
  });

  it('traduz credenciais inválidas sem expor detalhe interno', async () => {
    const supabase = clienteAuth();
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      error: { code: 'invalid_credentials' },
    });
    await expect(entrarComSenha('a@b.com', 'errada', undefined, supabase as never)).rejects.toEqual(
      new ErroDeAutenticacao('E-mail ou senha inválidos.'),
    );
  });

  it('não revela se a conta existe na recuperação', async () => {
    const supabase = clienteAuth();
    supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
      error: { code: 'user_not_found' },
    });
    await expect(
      solicitarRecuperacaoDeSenha('ausente@example.com', undefined, supabase as never),
    ).resolves.toBeUndefined();
  });
});
