import { respostaOk, rotaApi } from '@/lib/api/resposta';
/**
 * GET /api/recalibrar/gatilhos
 * Refresha a view materializada de KPIs e retorna diagnóstico de recalibração.
 */

import { getAdminClient } from '@/lib/supabase/admin';
import { verificarGatilhos } from '@/services/calibracao';

export const dynamic = 'force-dynamic';

export const GET = rotaApi('GET /api/recalibrar/gatilhos', async () => {
  const admin = getAdminClient();

  // Refresha view materializada via RPC
  await admin.rpc('refresh_kpis_usuario_diario');

  const resultado = await verificarGatilhos();

  return respostaOk(resultado);
});
