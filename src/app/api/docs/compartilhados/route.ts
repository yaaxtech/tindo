// RoadMapMind — API de "Compartilhados comigo": lista os docs de outras
// pessoas onde tenho acesso. Toda a lógica vive em src/services/compartilhar.ts.
// A cada carregamento roda a rede de segurança de reconciliação de convite
// pendente (Fatia 3) — best-effort, nunca lança, nunca bloqueia a listagem.

import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { exigirContextoAuth } from '@/lib/auth/server';
import { listarCompartilhadosComigo, reconciliarConvitesPendentes } from '@/services/compartilhar';

export const dynamic = 'force-dynamic';

export const GET = rotaApi('GET /api/docs/compartilhados', async () => {
  const contexto = await exigirContextoAuth();
  await reconciliarConvitesPendentes(contexto);
  return respostaOk({ itens: await listarCompartilhadosComigo(contexto) });
});
