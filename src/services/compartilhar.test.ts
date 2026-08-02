// @vitest-environment node

import type { ContextoAuth } from '@/lib/auth/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { carregarDocumentoCompartilhado, listarCompartilhadosComigo } from './compartilhar';

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
});
