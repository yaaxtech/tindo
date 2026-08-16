/**
 * Erros de aplicação — a ponte única entre o domínio e o HTTP.
 *
 * REGRA CENTRAL: a `message` de um `ErroDeAplicacao` é SEMPRE segura para
 * aparecer na tela (PT-BR, sem texto técnico). Qualquer outro erro — um
 * `PostgrestError`, um `TypeError`, um timeout de rede — é tratado como falha
 * interna: o detalhe vai só para o log do servidor e o cliente recebe
 * `MENSAGEM_ERRO_GENERICA`. É isso que impede mensagem de Postgres de vazar
 * para o usuário (CLAUDE.md: "Nenhum texto técnico na UI").
 *
 * O status HTTP passa a vir do TIPO do erro. Antes cada rota adivinhava o
 * status olhando o texto da mensagem (`mensagem.includes('Só o dono')`), o que
 * quebrava silenciosamente a cada ajuste de copy.
 */

/** Mensagem devolvida quando o erro não é um `ErroDeAplicacao` conhecido. */
export const MENSAGEM_ERRO_GENERICA =
  'Não foi possível concluir a ação agora. Tente de novo em instantes.';

/** Mensagem para corpo de requisição ilegível (JSON malformado). */
export const MENSAGEM_CORPO_INVALIDO = 'Não foi possível ler os dados enviados.';

export abstract class ErroDeAplicacao extends Error {
  /** Status HTTP que a rota deve devolver. */
  abstract readonly status: number;
  /** Discriminador estável para o cliente — nunca traduzir nem renomear. */
  abstract readonly codigo: string;

  /**
   * `opcoes.cause` guarda o erro original ao trocar uma falha técnica por uma
   * mensagem amigável — o log do servidor continua vendo a causa real.
   */
  constructor(mensagem: string, opcoes?: { cause?: unknown }) {
    super(mensagem, opcoes);
    // Só para stack trace/log; nenhuma decisão de código olha para `name`.
    this.name = new.target.name;
  }
}

/** 400 — o pedido chegou incompleto ou inválido. */
export class ErroValidacao extends ErroDeAplicacao {
  readonly status = 400;
  readonly codigo = 'VALIDACAO';
}

/** 401 — sem sessão válida. */
export class ErroNaoAutenticado extends ErroDeAplicacao {
  readonly status = 401;
  readonly codigo = 'NAO_AUTENTICADO';

  constructor(mensagem = 'Entre na sua conta para continuar.', opcoes?: { cause?: unknown }) {
    super(mensagem, opcoes);
  }
}

/** 403 — autenticado, mas sem direito sobre o recurso. */
export class ErroSemPermissao extends ErroDeAplicacao {
  readonly status = 403;
  readonly codigo = 'SEM_PERMISSAO';
}

/** 404 — recurso inexistente (ou invisível para quem pediu). */
export class ErroNaoEncontrado extends ErroDeAplicacao {
  readonly status = 404;
  readonly codigo = 'NAO_ENCONTRADO';
}

/** 409 — o estado atual do recurso impede a operação. */
export class ErroConflito extends ErroDeAplicacao {
  readonly status = 409;
  readonly codigo = 'CONFLITO';
}

/** 502 — dependência externa (Todoist, Claude, e-mail) falhou ou respondeu mal. */
export class ErroServicoExterno extends ErroDeAplicacao {
  readonly status = 502;
  readonly codigo = 'SERVICO_EXTERNO';
}

/**
 * 500 com mensagem escolhida por nós. Use quando a falha é interna mas já
 * existe um texto melhor para o usuário do que o genérico. Nunca coloque
 * detalhe técnico aqui — ele vai para a tela.
 */
export class ErroInterno extends ErroDeAplicacao {
  readonly status = 500;
  readonly codigo = 'INTERNO';
}

export function statusDoErro(erro: unknown): number {
  if (erro instanceof ErroDeAplicacao) return erro.status;
  // `request.json()` lança SyntaxError em corpo malformado: culpa do cliente.
  if (erro instanceof SyntaxError) return 400;
  return 500;
}

/** Texto que pode ir para a tela. Nunca devolve mensagem de erro desconhecido. */
export function mensagemSegura(erro: unknown): string {
  if (erro instanceof ErroDeAplicacao) return erro.message;
  if (erro instanceof SyntaxError) return MENSAGEM_CORPO_INVALIDO;
  return MENSAGEM_ERRO_GENERICA;
}

export function codigoDoErro(erro: unknown): string {
  if (erro instanceof ErroDeAplicacao) return erro.codigo;
  if (erro instanceof SyntaxError) return 'CORPO_INVALIDO';
  return 'INTERNO';
}
