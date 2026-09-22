'use server';

import { createClient } from '@/lib/supabase/server';
import { ehEmailDono, gravarRespostaDono } from '@/services/harness';

export type ResultadoResposta = { ok: true } | { ok: false; erro: string };

/** Aprovar (1) ou recusar (-1) uma proposta do motor. Só o dono logado. */
export async function responderProposta(alvoId: string, valor: -1 | 1): Promise<ResultadoResposta> {
  if (!/^P-\d+$/.test(alvoId) || (valor !== 1 && valor !== -1)) {
    return { ok: false, erro: 'Pedido inválido.' };
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!ehEmailDono(data.user?.email)) {
    return { ok: false, erro: 'Só o dono pode responder.' };
  }
  try {
    await gravarRespostaDono(supabase, { tipo: 'aprovacao', alvo_id: alvoId, valor });
    return { ok: true };
  } catch {
    return { ok: false, erro: 'Não consegui salvar. Tente de novo.' };
  }
}
