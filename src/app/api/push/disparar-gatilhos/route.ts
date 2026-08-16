import { ErroNaoAutenticado } from '@/lib/api/erros';
import { respostaOk, rotaApi } from '@/lib/api/resposta';
// Chamado pelo cron diário após refresh KPIs e sync Todoist.
// Auth: header `Authorization: Bearer <CRON_SECRET>`.

import { getUsuarioIdMVP } from '@/lib/supabase/admin';
import { verificarEDispararGatilhos } from '@/services/push';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const POST = rotaApi('POST /api/push/disparar-gatilhos', async (request: NextRequest) => {
  // Valida CRON_SECRET para uso do cron externo
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      throw new ErroNaoAutenticado('Não autorizado.');
    }
  }

  const usuarioId = await getUsuarioIdMVP();
  const resultados = await verificarEDispararGatilhos(usuarioId);
  return respostaOk({ ok: true, resultados });
});
