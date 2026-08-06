// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    mocks.createClient(...args);
    return { rpc: mocks.rpc };
  },
}));

import { documentoPublicoPorToken } from './publico';

function comRpc(porNome: Record<string, { data?: unknown; error?: unknown }>) {
  mocks.rpc.mockImplementation((nome: string) =>
    Promise.resolve(porNome[nome] ?? { data: [], error: null }),
  );
}

describe('documentoPublicoPorToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  it('devolve null quando a RPC não retorna linhas (restrito/inexistente)', async () => {
    comRpc({ documento_publico_por_token: { data: [], error: null } });
    await expect(documentoPublicoPorToken('tok')).resolves.toBeNull();
  });

  it('cria um cliente anônimo SEM sessão', async () => {
    comRpc({ documento_publico_por_token: { data: [], error: null } });
    await documentoPublicoPorToken('tok');
    expect(mocks.createClient).toHaveBeenCalledWith(
      'https://proj.supabase.co',
      'anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false }),
      }),
    );
  });

  it('mapeia linhas/espelhos e deriva a raiz (linha cujo pai está fora do conjunto)', async () => {
    comRpc({
      documento_publico_por_token: {
        data: [
          {
            id: 'raiz',
            pai_id: 'fora-da-arvore',
            ordem: 'a0',
            conteudo: [{ type: 'text', text: 'Título público' }],
            texto_md: 'Título público',
            tipo: 'texto',
            tarefa_estado: null,
            modo_lista: 'herdado',
          },
          {
            id: 'filho',
            pai_id: 'raiz',
            ordem: 'a1',
            conteudo: [{ type: 'text', text: 'item' }],
            texto_md: 'item',
            tipo: 'texto',
            tarefa_estado: null,
            modo_lista: 'marcadores',
          },
        ],
        error: null,
      },
      espelhos_publicos_por_token: {
        data: [{ id: 'e1', linha_id: 'filho', mae_id: 'raiz', ordem: 'a5' }],
        error: null,
      },
    });

    const doc = await documentoPublicoPorToken('tok');
    expect(doc).not.toBeNull();
    expect(doc?.raizId).toBe('raiz');
    expect(doc?.titulo).toBe('Título público');
    expect(doc?.linhas).toHaveLength(2);
    expect(doc?.espelhos).toEqual([{ id: 'e1', linhaId: 'filho', maeId: 'raiz', ordem: 'a5' }]);
    expect(mocks.rpc).toHaveBeenCalledWith('documento_publico_por_token', { p_token: 'tok' });
    expect(mocks.rpc).toHaveBeenCalledWith('espelhos_publicos_por_token', { p_token: 'tok' });
  });

  it('propaga erro da RPC (a API traduz em 500)', async () => {
    comRpc({ documento_publico_por_token: { data: null, error: new Error('boom') } });
    await expect(documentoPublicoPorToken('tok')).rejects.toThrow('boom');
  });
});
