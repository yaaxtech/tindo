import { describe, expect, it, vi } from 'vitest';
import {
  ErroDeAutenticacao,
  cadastrarComSenha,
  entrarComSenha,
  enviarLinkMagico,
  solicitarRecuperacaoDeSenha,
  urlDeCallback,
} from './auth';

function clienteAuth() {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
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

  it('cria conta com dados de perfil e callback para o RoadMapMind', async () => {
    const supabase = clienteAuth();
    await cadastrarComSenha(
      { nome: ' Pessoa ', email: ' pessoa@example.com ', senha: 'senha-segura', whatsapp: '' },
      'captcha',
      supabase as never,
    );
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'pessoa@example.com',
      password: 'senha-segura',
      options: expect.objectContaining({
        captchaToken: 'captcha',
        data: { name: 'Pessoa', whatsapp: null },
      }),
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

  it.each(['email_address_not_authorized', 'otp_disabled'])(
    'mantém recuperação indistinguível quando o e-mail não pode sair (%s)',
    async (code) => {
      const supabase = clienteAuth();
      supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { code } });

      await expect(
        solicitarRecuperacaoDeSenha('pessoa@example.com', undefined, supabase as never),
      ).resolves.toBeUndefined();
    },
  );

  it('mantém cadastro indistinguível quando o remetente não aceita o endereço', async () => {
    const supabase = clienteAuth();
    supabase.auth.signUp.mockResolvedValueOnce({
      data: { session: null },
      error: { code: 'email_address_not_authorized' },
    });

    await expect(
      cadastrarComSenha(
        { nome: 'Pessoa', email: 'pessoa@example.com', senha: 'senha-segura' },
        undefined,
        supabase as never,
      ),
    ).resolves.toEqual({ sessaoCriada: false });
  });

  it('mantém link mágico indistinguível quando o e-mail não pode sair', async () => {
    const supabase = clienteAuth();
    supabase.auth.signInWithOtp.mockResolvedValueOnce({
      error: { code: 'email_address_not_authorized' },
    });

    await expect(
      enviarLinkMagico('pessoa@example.com', '/docs', undefined, supabase as never),
    ).resolves.toBeUndefined();
  });
});
