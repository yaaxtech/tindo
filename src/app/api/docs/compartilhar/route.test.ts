// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exigirContextoAuth: vi.fn(),
  convidarPorEmail: vi.fn(),
  definirModoLink: vi.fn(),
  espelhosExternosDoDocumento: vi.fn(),
  linkDoDocumento: vi.fn(),
  listarAcesso: vi.fn(),
  regenerarToken: vi.fn(),
  revogar: vi.fn(),
  trocarPapel: vi.fn(),
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
  convidarPorEmail: mocks.convidarPorEmail,
  definirModoLink: mocks.definirModoLink,
  espelhosExternosDoDocumento: mocks.espelhosExternosDoDocumento,
  linkDoDocumento: mocks.linkDoDocumento,
  listarAcesso: mocks.listarAcesso,
  regenerarToken: mocks.regenerarToken,
  revogar: mocks.revogar,
  trocarPapel: mocks.trocarPapel,
}));

import { DELETE, GET, PATCH, POST, PUT } from './route';

const contexto = { usuarioId: 'owner-1', email: 'dono@example.com', supabase: {} };

function req(method: string, body?: unknown, query = ''): Request {
  return new Request(`https://tindo.example/api/docs/compartilhar${query}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

describe('/api/docs/compartilhar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exigirContextoAuth.mockResolvedValue(contexto);
    mocks.listarAcesso.mockResolvedValue([]);
    mocks.linkDoDocumento.mockResolvedValue({ modo: 'restrito', token: 'token-1' });
    mocks.espelhosExternosDoDocumento.mockResolvedValue(0);
  });

  it('GET devolve pessoas e link do documento', async () => {
    const acessos = [
      {
        usuarioId: 'user-2',
        email: 'ana@example.com',
        nome: 'Ana',
        papel: 'leitor',
        pendente: false,
      },
    ];
    mocks.listarAcesso.mockResolvedValue(acessos);

    const resposta = await GET(req('GET', undefined, '?documentoId=doc-A'));

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({
      acessos,
      link: { modo: 'restrito', token: 'token-1' },
      espelhosExternos: 0,
    });
    expect(mocks.listarAcesso).toHaveBeenCalledWith(contexto, 'doc-A');
    expect(mocks.linkDoDocumento).toHaveBeenCalledWith(contexto, 'doc-A');
  });

  it('POST convida uma conta existente', async () => {
    mocks.convidarPorEmail.mockResolvedValue({ status: 'concedido' });

    const resposta = await POST(
      req('POST', { documentoId: 'doc-A', email: 'ana@example.com', papel: 'leitor' }),
    );

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({ status: 'concedido' });
    expect(mocks.convidarPorEmail).toHaveBeenCalledWith(
      contexto,
      'doc-A',
      'ana@example.com',
      'leitor',
    );
  });

  it('POST informa que email sem conta fica para a Fatia 3', async () => {
    mocks.convidarPorEmail.mockResolvedValue({ status: 'pendente' });
    const resposta = await POST(
      req('POST', { documentoId: 'doc-A', email: 'nova@example.com', papel: 'editor' }),
    );

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({ status: 'pendente' });
  });

  it('PATCH troca o papel sem duplicar o acesso', async () => {
    const resposta = await PATCH(
      req('PATCH', { documentoId: 'doc-A', usuarioId: 'user-2', papel: 'editor' }),
    );

    expect(resposta.status).toBe(200);
    expect(mocks.trocarPapel).toHaveBeenCalledWith(contexto, 'doc-A', 'user-2', 'editor');
  });

  it('DELETE revoga o acesso', async () => {
    const resposta = await DELETE(req('DELETE', { documentoId: 'doc-A', usuarioId: 'user-2' }));

    expect(resposta.status).toBe(200);
    expect(mocks.revogar).toHaveBeenCalledWith(contexto, 'doc-A', 'user-2');
  });

  it('PUT alterna o modo do link', async () => {
    mocks.definirModoLink.mockResolvedValue({ modo: 'publico_leitura', token: 'token-1' });
    const resposta = await PUT(req('PUT', { documentoId: 'doc-A', modo: 'publico_leitura' }));

    await expect(resposta.json()).resolves.toEqual({
      link: { modo: 'publico_leitura', token: 'token-1' },
    });
    expect(mocks.definirModoLink).toHaveBeenCalledWith(contexto, 'doc-A', 'publico_leitura');
  });

  it('PUT regenera o token sem mudar o modo', async () => {
    mocks.regenerarToken.mockResolvedValue('token-2');
    const resposta = await PUT(req('PUT', { documentoId: 'doc-A', regenerar: true }));

    await expect(resposta.json()).resolves.toEqual({ token: 'token-2' });
    expect(mocks.regenerarToken).toHaveBeenCalledWith(contexto, 'doc-A');
    expect(mocks.definirModoLink).not.toHaveBeenCalled();
  });

  it('rejeita payload inválido antes de chamar o serviço', async () => {
    const resposta = await POST(
      req('POST', { documentoId: 'doc-A', email: '', papel: 'administrador' }),
    );

    expect(resposta.status).toBe(400);
    await expect(resposta.json()).resolves.toEqual({
      erro: 'Email e papel são obrigatórios.',
      codigo: 'VALIDACAO',
    });
    expect(mocks.convidarPorEmail).not.toHaveBeenCalled();
  });
});
