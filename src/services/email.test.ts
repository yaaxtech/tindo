// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enviarEmailConvite } from './email';

const ENV_ORIGINAL = { ...process.env };

function limparEnv() {
  process.env.EMAIL_ENVIO_ATIVO = undefined;
  process.env.RESEND_API_KEY = undefined;
  process.env.RESEND_FROM = undefined;
}

describe('services/email', () => {
  beforeEach(() => {
    limparEnv();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    vi.unstubAllGlobals();
  });

  const dadosBase = {
    para: 'ana@example.com',
    nomeDono: 'Maria',
    tituloDoc: 'Plano de Lançamento',
    url: 'https://tindoapp.pages.dev/docs?doc=doc-A',
    temConta: true,
  };

  it('com a flag desligada (default), não chama fetch', async () => {
    process.env.RESEND_API_KEY = 'chave-teste';

    await enviarEmailConvite(dadosBase);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('com a flag ligada mas sem RESEND_API_KEY, não chama fetch (não quebra o fluxo)', async () => {
    process.env.EMAIL_ENVIO_ATIVO = 'true';

    await enviarEmailConvite(dadosBase);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('com a flag ligada e chave configurada, faz POST ao Resend com o payload certo', async () => {
    process.env.EMAIL_ENVIO_ATIVO = 'true';
    process.env.RESEND_API_KEY = 'chave-teste';
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await enviarEmailConvite(dadosBase);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer chave-teste',
      'Content-Type': 'application/json',
    });
    const corpo = JSON.parse(init.body as string);
    expect(corpo.to).toBe('ana@example.com');
    expect(corpo.subject).toBe('Maria compartilhou um documento com você');
    expect(corpo.html).toContain('Maria');
    expect(corpo.html).toContain('Plano de Lançamento');
    expect(corpo.html).toContain('https://tindoapp.pages.dev/docs?doc=doc-A');
    expect(corpo.html).toContain('Abrir documento');
  });

  it('usa RESEND_FROM quando configurado; senão cai no remetente placeholder', async () => {
    process.env.EMAIL_ENVIO_ATIVO = 'true';
    process.env.RESEND_API_KEY = 'chave-teste';
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await enviarEmailConvite(dadosBase);
    let corpo = JSON.parse((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string);
    expect(corpo.from).toContain('tindoapp.pages.dev');

    process.env.RESEND_FROM = 'RoadMapMind <convites@meudominio.com>';
    await enviarEmailConvite(dadosBase);
    corpo = JSON.parse((vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit).body as string);
    expect(corpo.from).toBe('RoadMapMind <convites@meudominio.com>');
  });

  it('sem conta (temConta:false), o corpo aponta para o link de cadastro', async () => {
    process.env.EMAIL_ENVIO_ATIVO = 'true';
    process.env.RESEND_API_KEY = 'chave-teste';
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await enviarEmailConvite({
      ...dadosBase,
      url: 'https://tindoapp.pages.dev/cadastro',
      temConta: false,
    });

    const corpo = JSON.parse((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string);
    expect(corpo.html).toContain('https://tindoapp.pages.dev/cadastro');
    expect(corpo.html).toContain('Criar conta e ver o documento');
  });

  it('lança erro amigável se o Resend responder com falha', async () => {
    process.env.EMAIL_ENVIO_ATIVO = 'true';
    process.env.RESEND_API_KEY = 'chave-teste';
    vi.mocked(fetch).mockResolvedValue(new Response('erro', { status: 422 }));

    await expect(enviarEmailConvite(dadosBase)).rejects.toThrow(
      'Não foi possível enviar o email de convite.',
    );
  });

  it('escapa HTML nos campos vindos do usuário (nome/título)', async () => {
    process.env.EMAIL_ENVIO_ATIVO = 'true';
    process.env.RESEND_API_KEY = 'chave-teste';
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await enviarEmailConvite({
      ...dadosBase,
      nomeDono: '<script>alert(1)</script>',
      tituloDoc: '<img src=x onerror=alert(1)>',
    });

    const corpo = JSON.parse((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string);
    expect(corpo.html).not.toContain('<script>');
    expect(corpo.html).not.toContain('<img src=x');
  });
});
