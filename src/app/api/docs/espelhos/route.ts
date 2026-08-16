// RoadMapMind — espelhos (Fatia 7). POST cria; DELETE remove (soft).
// Toda lógica de dados vive em src/services/doc.ts.

import { ErroValidacao } from '@/lib/api/erros';
import { corpoJson, respostaOk, rotaApi } from '@/lib/api/resposta';
import { exigirContextoAuth } from '@/lib/auth/server';
import { criarEspelho, removerEspelho } from '@/services/doc';

export const POST = rotaApi('POST /api/docs/espelhos', async (req: Request) => {
  const contexto = await exigirContextoAuth();
  const body = (await corpoJson(req)) as { linhaId?: string; maeId?: string; ordem?: string };
  if (!body.linhaId || !body.maeId || !body.ordem) {
    throw new ErroValidacao('linhaId, maeId e ordem são obrigatórios.');
  }
  return respostaOk({
    espelho: await criarEspelho(contexto, body.linhaId, body.maeId, body.ordem),
  });
});

export const DELETE = rotaApi('DELETE /api/docs/espelhos', async (req: Request) => {
  const contexto = await exigirContextoAuth();
  const body = (await corpoJson(req)) as { id?: string };
  if (!body.id) throw new ErroValidacao('id é obrigatório.');
  await removerEspelho(contexto, body.id);
  return respostaOk({ ok: true });
});
