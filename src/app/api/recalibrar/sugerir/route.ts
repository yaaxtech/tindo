import { respostaOk, rotaApi } from '@/lib/api/resposta';
/**
 * POST /api/recalibrar/sugerir
 * Se houver gatilho ativo, marca recalibracao_sugerida_em e retorna motivo.
 */

import { marcarRecalibracaoSugerida, verificarGatilhos } from '@/services/calibracao';

export const dynamic = 'force-dynamic';

export const POST = rotaApi('POST /api/recalibrar/sugerir', async () => {
  const { gatilhos, deveRecalibrar } = await verificarGatilhos();

  if (!deveRecalibrar) {
    return respostaOk({ sugerida: false, motivo: null });
  }

  const motivo = gatilhos.map((g) => g.label).join('; ');
  await marcarRecalibracaoSugerida(motivo);

  return respostaOk({ sugerida: true, motivo });
});
