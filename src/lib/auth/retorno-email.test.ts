import { describe, expect, it, vi } from 'vitest';
import { tratarRetornoDoEmail } from './retorno-email';

function auth(erro: { code?: string } | null = null) {
  return {
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: erro }),
    verifyOtp: vi.fn().mockResolvedValue({ error: erro }),
  };
}

describe('tratarRetornoDoEmail', () => {
  it('troca o code PKCE e segue para o destino interno', async () => {
    const cliente = auth();
    const r = await tratarRetornoDoEmail(new URLSearchParams('code=abc&next=/cards'), cliente);
    expect(cliente.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(r).toEqual({ ok: true, destino: '/cards' });
  });

  it('valida token_hash (funciona em outro navegador) e leva a recuperação para /nova-senha', async () => {
    const cliente = auth();
    const r = await tratarRetornoDoEmail(
      new URLSearchParams('token_hash=h1&type=recovery'),
      cliente,
    );
    expect(cliente.verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'h1' });
    expect(cliente.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, destino: '/nova-senha' });
  });

  it('respeita o next do link mágico com token_hash', async () => {
    const r = await tratarRetornoDoEmail(
      new URLSearchParams('next=%2Fcards&token_hash=h1&type=magiclink'),
      auth(),
    );
    expect(r).toEqual({ ok: true, destino: '/cards' });
  });

  it('explica quando o link foi aberto em outro navegador', async () => {
    const r = await tratarRetornoDoEmail(
      new URLSearchParams('code=abc'),
      auth({ code: 'pkce_code_verifier_not_found' }),
    );
    expect(r).toEqual({ ok: false, erro: 'link-outro-navegador', destino: '/docs' });
  });

  it('trata link expirado, tipo desconhecido e ausência de código como link inválido', async () => {
    expect(
      await tratarRetornoDoEmail(new URLSearchParams('code=abc'), auth({ code: 'otp_expired' })),
    ).toMatchObject({ ok: false, erro: 'link-invalido' });
    expect(
      await tratarRetornoDoEmail(new URLSearchParams('token_hash=h&type=xpto'), auth()),
    ).toMatchObject({ ok: false, erro: 'link-invalido' });
    expect(
      await tratarRetornoDoEmail(new URLSearchParams('error_code=otp_expired'), auth()),
    ).toMatchObject({ ok: false, erro: 'link-invalido' });
  });

  it('descarta destino externo', async () => {
    const r = await tratarRetornoDoEmail(new URLSearchParams('code=abc&next=//evil.com'), auth());
    expect(r).toEqual({ ok: true, destino: '/docs' });
  });
});
