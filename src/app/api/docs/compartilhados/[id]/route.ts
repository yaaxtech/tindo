// RoadMapMind — API de um documento compartilhado. GET abre (leitura guarded; o
// papel vem da lista "compartilhados comigo", evitando probing); PUT salva como
// convidado EDITOR (Fatia 4) pela RPC guarded, que confina a escrita à subárvore.
// 403 se o doc não está compartilhado comigo / sem permissão de edição — quem
// devolve esse status é o tipo do erro (ErroSemPermissao), não o texto dele.

import { ErroSemPermissao } from '@/lib/api/erros';
import { corpoJson, respostaOk, rotaApi } from '@/lib/api/resposta';
import { exigirContextoAuth } from '@/lib/auth/server';
import {
  carregarDocumentoCompartilhado,
  listarCompartilhadosComigo,
  salvarDocumentoCompartilhado,
} from '@/services/compartilhar';
import type { DocLinha } from '@/types/doc';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

export const GET = rotaApi(
  'GET /api/docs/compartilhados/[id]',
  async (_req: Request, { params }: Contexto) => {
    const contexto = await exigirContextoAuth();
    const { id } = await params;

    const itens = await listarCompartilhadosComigo(contexto);
    const item = itens.find((i) => i.documentoId === id);
    if (!item) {
      throw new ErroSemPermissao('Este documento não está compartilhado com você.');
    }

    const { linhas, espelhos } = await carregarDocumentoCompartilhado(contexto, id);
    return respostaOk({
      papel: item.papel,
      dono: item.dono,
      tituloMd: item.tituloMd,
      linhas,
      espelhos,
    });
  },
);

export const PUT = rotaApi(
  'PUT /api/docs/compartilhados/[id]',
  async (req: Request, { params }: Contexto) => {
    const contexto = await exigirContextoAuth();
    const { id } = await params;
    const body = (await corpoJson(req)) as { linhas?: DocLinha[] };
    // A RPC guarded valida papel de editor e confina a escrita à subárvore.
    await salvarDocumentoCompartilhado(contexto, id, body.linhas ?? []);
    return respostaOk({ ok: true });
  },
);
