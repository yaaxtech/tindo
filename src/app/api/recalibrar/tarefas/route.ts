import { respostaOk, rotaApi } from '@/lib/api/resposta';
/**
 * GET /api/recalibrar/tarefas
 * Retorna 5 tarefas pendentes espalhadas por faixa de nota para o wizard.
 */

import { obterTarefasParaCalibrar } from '@/services/calibracao';

export const dynamic = 'force-dynamic';

export const GET = rotaApi('GET /api/recalibrar/tarefas', async () => {
  const tarefas = await obterTarefasParaCalibrar(5);
  return respostaOk({ tarefas });
});
