// RoadMapMind — Fase 2: gestão do compartilhamento de um documento.
// O status HTTP de cada falha vem do tipo lançado por src/services/compartilhar.ts
// (ErroSemPermissao → 403, ErroNaoEncontrado → 404…). Esta rota não interpreta
// mais o texto da mensagem para adivinhar o status.

import { ErroValidacao } from '@/lib/api/erros';
import { corpoJson, respostaOk, rotaApi } from '@/lib/api/resposta';
import { exigirContextoAuth } from '@/lib/auth/server';
import {
  convidarPorEmail,
  definirModoLink,
  espelhosExternosDoDocumento,
  linkDoDocumento,
  listarAcesso,
  regenerarToken,
  revogar,
  trocarPapel,
} from '@/services/compartilhar';
import type { ModoLink, Papel } from '@/types/compartilhar';

export const dynamic = 'force-dynamic';

function papelValido(valor: unknown): valor is Papel {
  return valor === 'leitor' || valor === 'editor';
}

function modoValido(valor: unknown): valor is ModoLink {
  return valor === 'restrito' || valor === 'publico_leitura';
}

export const GET = rotaApi('GET /api/docs/compartilhar', async (req: Request) => {
  const documentoId = new URL(req.url).searchParams.get('documentoId');
  if (!documentoId) throw new ErroValidacao('documentoId é obrigatório.');
  const contexto = await exigirContextoAuth();
  const [acessos, link, espelhosExternos] = await Promise.all([
    listarAcesso(contexto, documentoId),
    linkDoDocumento(contexto, documentoId),
    espelhosExternosDoDocumento(contexto, documentoId),
  ]);
  return respostaOk({ acessos, link, espelhosExternos });
});

export const POST = rotaApi('POST /api/docs/compartilhar', async (req: Request) => {
  const dados = await corpoJson(req);
  if (
    typeof dados.documentoId !== 'string' ||
    typeof dados.email !== 'string' ||
    !dados.email.trim() ||
    !papelValido(dados.papel)
  ) {
    throw new ErroValidacao('Email e papel são obrigatórios.');
  }
  const contexto = await exigirContextoAuth();
  return respostaOk(await convidarPorEmail(contexto, dados.documentoId, dados.email, dados.papel));
});

export const PATCH = rotaApi('PATCH /api/docs/compartilhar', async (req: Request) => {
  const dados = await corpoJson(req);
  if (
    typeof dados.documentoId !== 'string' ||
    typeof dados.usuarioId !== 'string' ||
    !papelValido(dados.papel)
  ) {
    throw new ErroValidacao('Documento, pessoa e papel são obrigatórios.');
  }
  const contexto = await exigirContextoAuth();
  await trocarPapel(contexto, dados.documentoId, dados.usuarioId, dados.papel);
  return respostaOk({ ok: true });
});

export const DELETE = rotaApi('DELETE /api/docs/compartilhar', async (req: Request) => {
  const dados = await corpoJson(req);
  if (typeof dados.documentoId !== 'string' || typeof dados.usuarioId !== 'string') {
    throw new ErroValidacao('Documento e pessoa são obrigatórios.');
  }
  const contexto = await exigirContextoAuth();
  await revogar(contexto, dados.documentoId, dados.usuarioId);
  return respostaOk({ ok: true });
});

export const PUT = rotaApi('PUT /api/docs/compartilhar', async (req: Request) => {
  const dados = await corpoJson(req);
  if (typeof dados.documentoId !== 'string') {
    throw new ErroValidacao('documentoId é obrigatório.');
  }
  const contexto = await exigirContextoAuth();
  if (dados.regenerar === true) {
    return respostaOk({ token: await regenerarToken(contexto, dados.documentoId) });
  }
  if (!modoValido(dados.modo)) throw new ErroValidacao('Modo do link inválido.');
  return respostaOk({ link: await definirModoLink(contexto, dados.documentoId, dados.modo) });
});
