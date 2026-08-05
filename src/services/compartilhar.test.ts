// @vitest-environment node

import type { ContextoAuth } from '@/lib/auth/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enviarEmailConvite: vi.fn(async () => undefined),
  obterPerfil: vi.fn(async () => ({ nome: 'Maria', email: 'dono@example.com' })),
}));

vi.mock('./email', () => ({ enviarEmailConvite: mocks.enviarEmailConvite }));
vi.mock('./perfil', () => ({ obterPerfil: mocks.obterPerfil }));

import type { DocLinha } from '@/types/doc';
import {
  carregarDocumentoCompartilhado,
  convidarPorEmail,
  definirModoLink,
  espelhosExternosDoDocumento,
  linkDoDocumento,
  listarAcesso,
  listarCompartilhadosComigo,
  reconciliarConvitesPendentes,
  regenerarToken,
  revogar,
  salvarDocumentoCompartilhado,
  trocarPapel,
} from './compartilhar';

type FakeResult = { data?: unknown; error?: unknown };

/**
 * Builder fluente que resolve com `resultado` independente do encadeamento
 * (`.select().eq().is().maybeSingle()` etc.) — mesmo padrão do fake usado em
 * kpis-adiamento.test.ts.
 */
function fakeBuilder(resultado: FakeResult) {
  // biome-ignore lint/suspicious/noExplicitAny: builder fluente genérico de teste
  const builder: Record<string, any> = {};
  const metodos = ['select', 'eq', 'is', 'order', 'limit', 'insert', 'update', 'upsert'];
  for (const metodo of metodos) builder[metodo] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(resultado));
  // biome-ignore lint/suspicious/noThenProperty: thenable intencional para simular Supabase query builder
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(resolve, reject);
  return builder;
}

/**
 * Fake do cliente Supabase: `rpc` responde por nome; `from` só responde às
 * tabelas explicitamente whitelistadas em `opts.from` — qualquer outra
 * chamada EXPLODE. O contrato de isolamento exige que a leitura de doc
 * alheio passe pela RPC guarded, nunca por um SELECT direto em doc_linhas.
 */
function fakeContexto(
  opts: { rpc?: Record<string, FakeResult>; from?: Record<string, FakeResult> } = {},
) {
  const rpc = vi.fn(async (nome: string) => opts.rpc?.[nome] ?? { data: [], error: null });
  const from = vi.fn((tabela: string) => {
    if (!opts.from || !(tabela in opts.from)) {
      throw new Error(`ISOLAMENTO VIOLADO: acesso inesperado a .from('${tabela}')`);
    }
    return fakeBuilder(opts.from[tabela] as FakeResult);
  });
  const contexto = {
    usuarioId: 'dono-1',
    email: 'dono@example.com',
    supabase: { rpc, from },
  } as unknown as ContextoAuth;
  return { contexto, rpc, from };
}

describe('services/compartilhar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.obterPerfil.mockResolvedValue({ nome: 'Maria', email: 'dono@example.com' });
  });

  it('listarCompartilhadosComigo chama a RPC e mapeia snake→camel', async () => {
    const { contexto, rpc, from } = fakeContexto({
      rpc: {
        listar_compartilhados_comigo: {
          data: [{ documento_id: 'doc-A', titulo_md: 'Plano', papel: 'leitor', dono: 'dono-1' }],
          error: null,
        },
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
      rpc: {
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
      rpc: {
        documento_compartilhado: { data: [], error: null },
        espelhos_do_documento_compartilhado: { data: [], error: null },
      },
    });

    const { linhas, espelhos } = await carregarDocumentoCompartilhado(contexto, 'doc-de-outro');

    expect(linhas).toEqual([]);
    expect(espelhos).toEqual([]);
  });

  it('propaga erro da RPC', async () => {
    const { contexto } = fakeContexto({
      rpc: { listar_compartilhados_comigo: { data: null, error: new Error('falhou') } },
    });
    await expect(listarCompartilhadosComigo(contexto)).rejects.toThrow('falhou');
  });

  it('lista os acessos com identidade e papel', async () => {
    const { contexto, rpc } = fakeContexto({
      rpc: {
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
      rpc: {
        trocar_papel_documento: { data: null, error: null },
        revogar_acesso_documento: { data: null, error: null },
      },
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
      rpc: {
        configurar_link_documento: {
          data: [{ modo_link: 'publico_leitura', link_token: 'token-novo' }],
          error: null,
        },
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
      rpc: { trocar_papel_documento: { data: null, error: new Error('SEM_PERMISSAO') } },
    });

    await expect(trocarPapel(contexto, 'doc-A', 'user-2', 'editor')).rejects.toThrow(
      'Só o dono pode compartilhar este documento.',
    );
  });

  describe('convidarPorEmail — email/Resend (Fatia 3)', () => {
    it('auto-convite não busca perfil/título nem envia email', async () => {
      const { contexto, rpc } = fakeContexto({
        rpc: { convidar_usuario_documento: { data: [{ status: 'auto' }], error: null } },
      });

      await expect(
        convidarPorEmail(contexto, 'doc-A', 'dono@example.com', 'editor'),
      ).resolves.toEqual({ status: 'auto' });

      expect(rpc).toHaveBeenCalledWith('convidar_usuario_documento', {
        p_documento: 'doc-A',
        p_email: 'dono@example.com',
        p_papel: 'editor',
      });
      expect(mocks.obterPerfil).not.toHaveBeenCalled();
      expect(mocks.enviarEmailConvite).not.toHaveBeenCalled();
    });

    it.each(['concedido', 'ja_tem'] as const)(
      'conta existente (%s) envia email com o link do DOCUMENTO',
      async (status) => {
        const { contexto } = fakeContexto({
          rpc: { convidar_usuario_documento: { data: [{ status }], error: null } },
          from: {
            doc_linhas: { data: { texto_md: 'Plano de Lançamento' }, error: null },
          },
        });

        await expect(
          convidarPorEmail(contexto, 'doc-A', '  ANA@Example.com ', 'leitor'),
        ).resolves.toEqual({ status });

        expect(mocks.enviarEmailConvite).toHaveBeenCalledWith({
          para: 'ana@example.com',
          nomeDono: 'Maria',
          tituloDoc: 'Plano de Lançamento',
          url: 'https://tindoapp.pages.dev/docs?doc=doc-A',
          temConta: true,
        });
      },
    );

    it('email sem conta (pendente) grava doc_convites e envia email de CADASTRO', async () => {
      const { contexto, from } = fakeContexto({
        rpc: { convidar_usuario_documento: { data: [{ status: 'pendente' }], error: null } },
        from: {
          doc_linhas: { data: { texto_md: 'Plano de Lançamento' }, error: null },
          doc_convites: { data: null, error: null }, // select: nenhum pendente existente
        },
      });

      await expect(
        convidarPorEmail(contexto, 'doc-A', 'nova@example.com', 'editor'),
      ).resolves.toEqual({ status: 'pendente' });

      expect(from).toHaveBeenCalledWith('doc_convites');
      expect(mocks.enviarEmailConvite).toHaveBeenCalledWith({
        para: 'nova@example.com',
        nomeDono: 'Maria',
        tituloDoc: 'Plano de Lançamento',
        url: 'https://tindoapp.pages.dev/cadastro',
        temConta: false,
      });
    });

    it('convite pendente repetido reenvia o email sem duplicar a linha', async () => {
      const builderDocLinhas = fakeBuilder({ data: { texto_md: 'Plano' }, error: null });
      const builderConvites = fakeBuilder({ data: { id: 'convite-1' }, error: null });
      const { contexto, from } = fakeContexto({
        rpc: { convidar_usuario_documento: { data: [{ status: 'pendente' }], error: null } },
      });
      from.mockImplementation((tabela: string) => {
        if (tabela === 'doc_linhas') return builderDocLinhas;
        if (tabela === 'doc_convites') return builderConvites;
        throw new Error(`ISOLAMENTO VIOLADO: .from('${tabela}')`);
      });

      await convidarPorEmail(contexto, 'doc-A', 'nova@example.com', 'leitor');

      expect(builderConvites.update).toHaveBeenCalled();
      expect(builderConvites.insert).not.toHaveBeenCalled();
      expect(mocks.enviarEmailConvite).toHaveBeenCalledTimes(1);
    });

    it('email de conta existente vazio de título usa fallback amigável', async () => {
      const { contexto } = fakeContexto({
        rpc: { convidar_usuario_documento: { data: [{ status: 'concedido' }], error: null } },
        from: { doc_linhas: { data: { texto_md: null }, error: null } },
      });

      await convidarPorEmail(contexto, 'doc-A', 'ana@example.com', 'leitor');

      expect(mocks.enviarEmailConvite).toHaveBeenCalledWith(
        expect.objectContaining({ tituloDoc: 'Documento sem título' }),
      );
    });
  });

  describe('reconciliarConvitesPendentes — rede de segurança do 1º login', () => {
    it('chama a RPC sem parâmetros (identidade vem de auth.uid() no banco)', async () => {
      const { contexto, rpc } = fakeContexto({
        rpc: { reconciliar_convites_pendentes: { data: null, error: null } },
      });

      await reconciliarConvitesPendentes(contexto);

      expect(rpc).toHaveBeenCalledWith('reconciliar_convites_pendentes');
    });

    it('nunca lança — best-effort mesmo se a RPC falhar ou ainda não existir', async () => {
      const { contexto } = fakeContexto({
        rpc: {
          reconciliar_convites_pendentes: {
            data: null,
            error: new Error('function does not exist'),
          },
        },
      });

      await expect(reconciliarConvitesPendentes(contexto)).resolves.toBeUndefined();
    });
  });

  describe('salvarDocumentoCompartilhado — escrita guarded do convidado editor', () => {
    const linha: DocLinha = {
      id: 'b1',
      paiId: 'doc-B',
      ordem: 'a0',
      conteudo: [{ type: 'text', text: 'oi' }],
      textoMd: 'oi',
      tipo: 'texto',
      tarefaEstado: null,
      modoLista: 'marcadores',
    };

    it('chama a RPC guarded com p_linhas em snake (sem texto_md) e nunca .from', async () => {
      const { contexto, rpc, from } = fakeContexto({
        rpc: { salvar_documento_compartilhado: { data: null, error: null } },
      });

      await salvarDocumentoCompartilhado(contexto, 'doc-B', [linha]);

      expect(from).not.toHaveBeenCalled();
      expect(rpc).toHaveBeenCalledWith('salvar_documento_compartilhado', {
        p_documento: 'doc-B',
        p_linhas: [
          {
            id: 'b1',
            pai_id: 'doc-B',
            ordem: 'a0',
            conteudo: [{ type: 'text', text: 'oi' }],
            tipo: 'texto',
            tarefa_estado: null,
            modo_lista: 'marcadores',
          },
        ],
      });
    });

    it('SEM_PERMISSAO vira mensagem amigável de edição', async () => {
      const { contexto } = fakeContexto({
        rpc: {
          salvar_documento_compartilhado: { data: null, error: { message: 'SEM_PERMISSAO' } },
        },
      });

      await expect(salvarDocumentoCompartilhado(contexto, 'doc-B', [linha])).rejects.toThrow(
        /permissão para editar/,
      );
    });
  });

  describe('espelhosExternosDoDocumento — aviso de espelho externo', () => {
    it('retorna a contagem da RPC', async () => {
      const { contexto, rpc } = fakeContexto({
        rpc: { espelhos_externos_do_documento: { data: 2, error: null } },
      });

      await expect(espelhosExternosDoDocumento(contexto, 'doc-B')).resolves.toBe(2);
      expect(rpc).toHaveBeenCalledWith('espelhos_externos_do_documento', { p_documento: 'doc-B' });
    });

    it('best-effort: devolve 0 se a RPC falhar', async () => {
      const { contexto } = fakeContexto({
        rpc: {
          espelhos_externos_do_documento: { data: null, error: new Error('boom') },
        },
      });

      await expect(espelhosExternosDoDocumento(contexto, 'doc-B')).resolves.toBe(0);
    });
  });
});
