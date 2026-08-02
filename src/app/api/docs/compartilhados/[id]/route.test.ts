// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exigirContextoAuth: vi.fn(),
  listarCompartilhadosComigo: vi.fn(),
  carregarDocumentoCompartilhado: vi.fn(),
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

vi.mock('@/services/compartilhar', () => ({
  listarCompartilhadosComigo: mocks.listarCompartilhadosComigo,
  carregarDocumentoCompartilhado: mocks.carregarDocumentoCompartilhado,
}));

import { UsuarioNaoAutenticadoError } from '@/lib/auth/server';
import { GET } from './route';

function req() {
  return new Request('https://tindo.example/api/docs/compartilhados/doc-A');
}

describe('GET /api/docs/compartilhados/[id]', () => {
  const contexto = { usuarioId: 'guest-1', supabase: {}, email: 'g@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exigirContextoAuth.mockResolvedValue(contexto);
    mocks.listarCompartilhadosComigo.mockResolvedValue([]);
    mocks.carregarDocumentoCompartilhado.mockResolvedValue({ linhas: [], espelhos: [] });
  });

  it('responde 401 sem sessão', async () => {
    mocks.exigirContextoAuth.mockRejectedValue(new UsuarioNaoAutenticadoError());
    const resposta = await GET(req(), { params: Promise.resolve({ id: 'doc-A' }) });
    expect(resposta.status).toBe(401);
    expect(mocks.carregarDocumentoCompartilhado).not.toHaveBeenCalled();
  });

  it('responde 403 e NÃO carrega quando o doc não está compartilhado comigo', async () => {
    mocks.listarCompartilhadosComigo.mockResolvedValue([
      { documentoId: 'outro', tituloMd: 'x', papel: 'leitor', dono: 'd' },
    ]);
    const resposta = await GET(req(), { params: Promise.resolve({ id: 'doc-A' }) });
    expect(resposta.status).toBe(403);
    expect(mocks.carregarDocumentoCompartilhado).not.toHaveBeenCalled();
  });

  it('carrega a subárvore com o papel vindo da lista quando compartilhado', async () => {
    mocks.listarCompartilhadosComigo.mockResolvedValue([
      { documentoId: 'doc-A', tituloMd: 'Plano', papel: 'leitor', dono: 'dono-1' },
    ]);
    mocks.carregarDocumentoCompartilhado.mockResolvedValue({
      linhas: [
        {
          id: 'l1',
          paiId: null,
          ordem: 'a0',
          conteudo: [],
          textoMd: 'Plano',
          tipo: 'texto',
          tarefaEstado: null,
          modoLista: 'herdado',
        },
      ],
      espelhos: [],
    });
    const resposta = await GET(req(), { params: Promise.resolve({ id: 'doc-A' }) });
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.papel).toBe('leitor');
    expect(corpo.dono).toBe('dono-1');
    expect(corpo.linhas).toHaveLength(1);
    expect(mocks.carregarDocumentoCompartilhado).toHaveBeenCalledWith(contexto, 'doc-A');
  });
});
