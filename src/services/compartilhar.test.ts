// @vitest-environment node

import type { ContextoAuth } from '@/lib/auth/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  carregarDocumentoCompartilhado,
  convidarPorEmail,
  definirModoLink,
  linkDoDocumento,
  listarAcesso,
  listarCompartilhadosComigo,
  regenerarToken,
  revogar,
  trocarPapel,
} from './compartilhar';

/**
 * Fake do cliente Supabase: só expõe `rpc` (respondendo por nome) e um `from`
 * que EXPLODE se chamado — o contrato de isolamento exige que a leitura de doc
 * alheio passe pela RPC guarded, nunca por um SELECT direto em doc_linhas.
 */
function fakeContexto(respostas: Record<string, { data?: unknown; error?: unknown }>) {
  const rpc = vi.fn(async (nome: string) => respostas[nome] ?? { data: [], error: null });
  const from = vi.fn(() => {
    throw new Error('ISOLAMENTO VIOLADO: leitura de compartilhado não pode usar .from()');
  });
  const contexto = {
    usuarioId: 'guest-1',
    email: 'guest@example.com',
    supabase: { rpc, from },
  } as unknown as ContextoAuth;
  return { contexto, rpc, from };
}

describe('services/compartilhar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listarCompartilhadosComigo chama a RPC e mapeia snake→camel', async () => {
    const { contexto, rpc, from } = fakeContexto({
      listar_compartilhados_comigo: {
        data: [{ documento_id: 'doc-A', titulo_md: 'Plano', papel: 'leitor', dono: 'dono-1' }],
        error: null,
      },
    });

    const itens = await listarCompartilhadosComigo(contexto);

    expect(rpc).toHaveBeenCalledWith('listar_compartilhados_comigo');
    expect(from).not.toHaveBeenCalled();
    expect(itens).toEqual([
      { documentoId: 'doc-A', tituloMd: 'Plano', papel: 'leitor', dono: 'dono-1' },
    ]);
  });

  it('carregarDocumentoCompartilhado usa as RPCs guarded (nunca .from) e mapeia', async () => {
    const { contexto, rpc, from } = fakeContexto({
      documento_compartilhado: {
        data: [
          {
            id: 'l1',
            pai_id: null,
            ordem: 'a0',
            conteudo: [{ type: 'text', text: 'oi' }],
            texto_md: 'oi',
            tipo: 'texto',
            tarefa_estado: null,
            modo_lista: 'herdado',
          },
        ],
        error: null,
      },
      espelhos_do_documento_compartilhado: {
        data: [{ id: 'e1', linha_id: 'lx', mae_id: 'l1', ordem: 'a5' }],
        error: null,
      },
    });

    const { linhas, espelhos } = await carregarDocumentoCompartilhado(contexto, 'doc-A');

    expect(rpc).toHaveBeenCalledWith('documento_compartilhado', { p_documento: 'doc-A' });
    expect(rpc).toHaveBeenCalledWith('espelhos_do_documento_compartilhado', {
      p_documento: 'doc-A',
    });
    expect(from).not.toHaveBeenCalled();
    expect(linhas).toEqual([
      {
        id: 'l1',
        paiId: null,
        ordem: 'a0',
        conteudo: [{ type: 'text', text: 'oi' }],
        textoMd: 'oi',
        tipo: 'texto',
        tarefaEstado: null,
        modoLista: 'herdado',
      },
    ]);
    expect(espelhos).toEqual([{ id: 'e1', linhaId: 'lx', maeId: 'l1', ordem: 'a5' }]);
  });

  it('sem acesso, a RPC devolve vazio → serviço devolve vazio (isolamento do banco)', async () => {
    const { contexto } = fakeContexto({
      documento_compartilhado: { data: [], error: null },
      espelhos_do_documento_compartilhado: { data: [], error: null },
    });

    const { linhas, espelhos } = await carregarDocumentoCompartilhado(contexto, 'doc-de-outro');

    expect(linhas).toEqual([]);
    expect(espelhos).toEqual([]);
  });

  it('propaga erro da RPC', async () => {
    const { contexto } = fakeContexto({
      listar_compartilhados_comigo: { data: null, error: new Error('falhou') },
    });
    await expect(listarCompartilhadosComigo(contexto)).rejects.toThrow('falhou');
  });

  it('convida conta existente e normaliza o email antes da RPC', async () => {
    const { contexto, rpc } = fakeContexto({
      convidar_usuario_documento: {
        data: [
          {
            status: 'concedido',
            usuario_id: 'user-2',
            email: 'ana@example.com',
            nome: 'Ana',
            cor: '#198b74',
            papel: 'leitor',
          },
        ],
        error: null,
      },
    });

    await expect(
      convidarPorEmail(contexto, 'doc-A', '  ANA@Example.com ', 'leitor'),
    ).resolves.toEqual({ status: 'concedido' });
    expect(rpc).toHaveBeenCalledWith('convidar_usuario_documento', {
      p_documento: 'doc-A',
      p_email: 'ana@example.com',
      p_papel: 'leitor',
    });
  });

  it.each(['pendente', 'ja_tem', 'auto'] as const)(
    'preserva o status %s retornado pelo convite',
    async (status) => {
      const { contexto } = fakeContexto({
        convidar_usuario_documento: { data: [{ status }], error: null },
      });
      await expect(
        convidarPorEmail(contexto, 'doc-A', 'pessoa@example.com', 'editor'),
      ).resolves.toEqual({ status });
    },
  );

  it('lista os acessos com identidade e papel', async () => {
    const { contexto, rpc } = fakeContexto({
      listar_acessos_documento: {
        data: [
          {
            usuario_id: 'user-2',
            email: 'ana@example.com',
            nome: 'Ana',
            cor: '#198b74',
            papel: 'editor',
          },
        ],
        error: null,
      },
    });

    await expect(listarAcesso(contexto, 'doc-A')).resolves.toEqual([
      {
        usuarioId: 'user-2',
        email: 'ana@example.com',
        nome: 'Ana',
        cor: '#198b74',
        papel: 'editor',
        pendente: false,
      },
    ]);
    expect(rpc).toHaveBeenCalledWith('listar_acessos_documento', {
      p_documento: 'doc-A',
    });
  });

  it('troca papel e revoga acesso pelas RPCs do dono', async () => {
    const { contexto, rpc } = fakeContexto({
      trocar_papel_documento: { data: null, error: null },
      revogar_acesso_documento: { data: null, error: null },
    });

    await trocarPapel(contexto, 'doc-A', 'user-2', 'leitor');
    await revogar(contexto, 'doc-A', 'user-2');

    expect(rpc).toHaveBeenCalledWith('trocar_papel_documento', {
      p_documento: 'doc-A',
      p_usuario: 'user-2',
      p_papel: 'leitor',
    });
    expect(rpc).toHaveBeenCalledWith('revogar_acesso_documento', {
      p_documento: 'doc-A',
      p_usuario: 'user-2',
    });
  });

  it('lê, alterna e regenera o link sem expor a tabela', async () => {
    const { contexto, rpc, from } = fakeContexto({
      configurar_link_documento: {
        data: [{ modo_link: 'publico_leitura', link_token: 'token-novo' }],
        error: null,
      },
    });

    await expect(linkDoDocumento(contexto, 'doc-A')).resolves.toEqual({
      modo: 'publico_leitura',
      token: 'token-novo',
    });
    await expect(definirModoLink(contexto, 'doc-A', 'publico_leitura')).resolves.toEqual({
      modo: 'publico_leitura',
      token: 'token-novo',
    });
    await expect(regenerarToken(contexto, 'doc-A')).resolves.toBe('token-novo');

    expect(rpc).toHaveBeenNthCalledWith(1, 'configurar_link_documento', {
      p_documento: 'doc-A',
      p_modo: null,
      p_regenerar: false,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'configurar_link_documento', {
      p_documento: 'doc-A',
      p_modo: 'publico_leitura',
      p_regenerar: false,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, 'configurar_link_documento', {
      p_documento: 'doc-A',
      p_modo: null,
      p_regenerar: true,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('traduz erros conhecidos do banco para PT-BR', async () => {
    const { contexto } = fakeContexto({
      trocar_papel_documento: { data: null, error: new Error('SEM_PERMISSAO') },
    });

    await expect(trocarPapel(contexto, 'doc-A', 'user-2', 'editor')).rejects.toThrow(
      'Só o dono pode compartilhar este documento.',
    );
  });
});
