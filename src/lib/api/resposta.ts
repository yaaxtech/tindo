/**
 * Envelope único de resposta das rotas de API.
 *
 * Antes deste módulo cada rota montava o próprio envelope: 41 rotas usavam a
 * chave `error`, 7 usavam `erro`, 5 reimplementavam a mesma função
 * `respostaErro` e uma usava as duas chaves no mesmo arquivo. Aqui existe uma
 * forma só:
 *
 *   sucesso →  { ...dados }
 *   erro    →  { erro: 'texto em PT-BR', codigo: 'DISCRIMINADOR' }
 *
 * O `codigo` existe para o cliente decidir sem ler o texto — a mesma armadilha
 * (`mensagem.includes(...)`) que as rotas caíam do lado do servidor.
 */

import { NextResponse } from 'next/server';
import { codigoDoErro, mensagemSegura, statusDoErro } from './erros';

export interface CorpoDeErro {
  erro: string;
  codigo: string;
}

/**
 * `init` aceita o status direto (`respostaOk(x, 201)`) ou um `ResponseInit`
 * completo, para quando a rota precisa de cabeçalho — `Cache-Control`, por
 * exemplo, em `/api/todoist/previa`.
 */
export function respostaOk<T>(dados: T, init: number | ResponseInit = 200): NextResponse<T> {
  return NextResponse.json(dados, typeof init === 'number' ? { status: init } : init);
}

/**
 * Converte qualquer coisa lançada na resposta HTTP certa.
 *
 * `rota` é só a etiqueta do log (ex.: `'GET /api/docs'`), para achar a origem
 * sem depender do stack trace no runtime da Cloudflare.
 */
export function respostaErro(rota: string, erro: unknown): NextResponse<CorpoDeErro> {
  const status = statusDoErro(erro);
  // 4xx é erro de quem chamou e já vem com mensagem pensada: não polui o log.
  // 5xx é falha nossa — o detalhe técnico existe SÓ aqui, nunca na resposta.
  if (status >= 500) console.error(`[${rota}]`, erro);
  return NextResponse.json({ erro: mensagemSegura(erro), codigo: codigoDoErro(erro) }, { status });
}

/**
 * Embrulha um handler de rota com o `try/catch` que todas as 50 rotas repetiam.
 * O handler passa a só fazer o caminho feliz e lançar erro tipado no resto.
 *
 * ```ts
 * export const GET = rotaApi('GET /api/docs', async () => {
 *   const contexto = await exigirContextoAuth();
 *   return respostaOk({ linhas: await carregarDocumento(contexto) });
 * });
 * ```
 */
export function rotaApi<Args extends unknown[]>(
  rota: string,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (erro) {
      return respostaErro(rota, erro);
    }
  };
}

/**
 * Lê o corpo JSON como objeto. JSON malformado vira 400 (via `SyntaxError`),
 * não o 500 que as rotas devolviam antes.
 */
export async function corpoJson(requisicao: Request): Promise<Record<string, unknown>> {
  const dados: unknown = await requisicao.json();
  if (dados === null || typeof dados !== 'object' || Array.isArray(dados)) {
    throw new SyntaxError('Corpo da requisição não é um objeto JSON.');
  }
  return dados as Record<string, unknown>;
}
