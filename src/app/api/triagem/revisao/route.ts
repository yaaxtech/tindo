import { corpoJson, respostaOk, rotaApi } from '@/lib/api/resposta';
import { listarRevisao, registrarRevisao } from '@/services/triagem-revisao';

export const dynamic = 'force-dynamic';

/** Sugestões do vigia nos itens do Todoist, com a revisão já feita (se houver). */
export const GET = rotaApi('GET /api/triagem/revisao', async () => {
  return respostaOk(await listarRevisao());
});

/** Grava a revisão do dono como comentário no item (não muda a tarefa). */
export const POST = rotaApi('POST /api/triagem/revisao', async (request: Request) => {
  const corpo = await corpoJson(request);
  const revisao = await registrarRevisao(
    typeof corpo.tarefaId === 'string' ? corpo.tarefaId : '',
    corpo.campos,
    typeof corpo.nota === 'string' ? corpo.nota : '',
  );
  return respostaOk({ revisao });
});
