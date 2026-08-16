// RoadMapMind — Fase 2 / Fatia 5: API PÚBLICA (sem login) de um documento por
// token. Liberada do gate de auth em `routes.ts`; a segurança fica no banco
// (RPCs anônimas só devolvem doc `publico_leitura`). 404 quando indisponível —
// nunca expõe o id interno do documento.

import { ErroInterno, ErroNaoEncontrado } from '@/lib/api/erros';
import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { documentoPublicoPorToken } from '@/services/publico';

export const dynamic = 'force-dynamic';

export const GET = rotaApi(
  'GET /api/docs/compartilhado/[token]',
  async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
    const { token } = await params;
    let documento: Awaited<ReturnType<typeof documentoPublicoPorToken>>;
    try {
      documento = await documentoPublicoPorToken(token);
    } catch (causa) {
      // Rota anônima: troca a falha técnica por um texto próprio, mas mantém a
      // causa para o log do servidor (o kernel imprime a cadeia em 5xx).
      throw new ErroInterno('Não foi possível abrir este documento agora.', { cause: causa });
    }
    if (!documento) throw new ErroNaoEncontrado('Documento indisponível.');
    return respostaOk(documento);
  },
);
