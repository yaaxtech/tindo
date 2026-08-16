// RoadMapMind — API do documento. GET carrega (garante a raiz); PUT sincroniza.
// Toda lógica de dados vive em src/services/doc.ts; o envelope de erro e o
// try/catch vivem no kernel em src/lib/api.

import { ErroValidacao } from '@/lib/api/erros';
import { corpoJson, respostaOk, rotaApi } from '@/lib/api/resposta';
import { exigirContextoAuth } from '@/lib/auth/server';
import { carregarDocumento, carregarEspelhos, garantirRaiz, salvarDocumento } from '@/services/doc';
import type { DocLinha } from '@/types/doc';

export const GET = rotaApi('GET /api/docs', async () => {
  const contexto = await exigirContextoAuth();
  const raiz = await garantirRaiz(contexto);
  const linhas = await carregarDocumento(contexto);
  const espelhos = await carregarEspelhos(contexto);
  return respostaOk({ raiz, linhas, espelhos });
});

export const PUT = rotaApi('PUT /api/docs', async (req: Request) => {
  const contexto = await exigirContextoAuth();
  const body = (await corpoJson(req)) as { raizId?: string; linhas?: DocLinha[] };
  if (!body.raizId) throw new ErroValidacao('raizId é obrigatório.');
  await salvarDocumento(contexto, body.linhas ?? [], body.raizId);
  return respostaOk({ ok: true });
});
