'use server';

import { mensagemSegura } from '@/lib/api/erros';
import { responderPropostaDono } from '@/services/harness-servidor';

export type ResultadoResposta = { ok: true } | { ok: false; erro: string };

/** Aprovar (1) ou recusar (-1) uma proposta do motor. O serviço confere o dono. */
export async function responderProposta(alvoId: string, valor: -1 | 1): Promise<ResultadoResposta> {
  try {
    await responderPropostaDono(alvoId, valor);
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: mensagemSegura(erro) };
  }
}
