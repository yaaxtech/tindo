// Perfil da pessoa logada. As validações de campo vivem em src/services/perfil.ts
// e chegam aqui como ErroValidacao → 400; falha de banco vira 500 genérico em
// vez do 400 que esta rota devolvia para qualquer erro.

import { ErroValidacao } from '@/lib/api/erros';
import { corpoJson, respostaOk, rotaApi } from '@/lib/api/resposta';
import { exigirContextoAuth } from '@/lib/auth/server';
import { atualizarPerfil, obterPerfil } from '@/services/perfil';

export const GET = rotaApi('GET /api/perfil', async () => {
  return respostaOk({ perfil: await obterPerfil(await exigirContextoAuth()) });
});

export const PATCH = rotaApi('PATCH /api/perfil', async (request: Request) => {
  const contexto = await exigirContextoAuth();
  const body = (await corpoJson(request)) as {
    nome?: string;
    whatsapp?: string | null;
    cor?: string;
  };
  if (typeof body.nome !== 'string' || typeof body.cor !== 'string') {
    throw new ErroValidacao('Nome e cor são obrigatórios.');
  }
  return respostaOk({
    perfil: await atualizarPerfil(contexto, {
      nome: body.nome,
      whatsapp: body.whatsapp,
      cor: body.cor,
    }),
  });
});
