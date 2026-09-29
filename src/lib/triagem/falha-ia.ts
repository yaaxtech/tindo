import Anthropic from '@anthropic-ai/sdk';

export interface FalhaIA {
  mensagem: string;
  /** Falha que vai se repetir em todos os itens (chave, crédito, modelo): parar na hora. */
  geral: boolean;
}

function textoDaApi(err: InstanceType<typeof Anthropic.APIError>): string {
  const corpo = err.error as { error?: { message?: unknown } } | undefined;
  const msg = corpo?.error?.message;
  return typeof msg === 'string' ? msg : err.message;
}

/** Traduz o erro da API Claude num motivo que o dono entende. */
export function descreverFalhaIA(err: unknown): FalhaIA {
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError
  ) {
    return {
      mensagem: 'A chave da Claude foi recusada. Confira ou troque a chave em Configurações > IA.',
      geral: true,
    };
  }
  if (err instanceof Anthropic.NotFoundError) {
    return {
      mensagem: 'O modelo de IA escolhido não existe mais. Escolha outro em Configurações > IA.',
      geral: true,
    };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return {
      mensagem: 'A IA atingiu o limite de uso por minuto. Espere um pouco e gere de novo.',
      geral: true,
    };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { mensagem: 'Não consegui falar com a IA agora. Tente de novo.', geral: true };
  }
  if (err instanceof Anthropic.BadRequestError) {
    const texto = textoDaApi(err);
    if (/credit|billing|balance/i.test(texto)) {
      return {
        mensagem:
          'A conta da Claude ligada ao TinDo está sem créditos. Recarregue em console.anthropic.com.',
        geral: true,
      };
    }
    return { mensagem: `A IA recusou o pedido (${texto.slice(0, 160)}).`, geral: true };
  }
  if (err instanceof Anthropic.APIError) {
    return { mensagem: 'A IA está instável agora. Tente de novo em alguns minutos.', geral: false };
  }
  return { mensagem: 'A IA não conseguiu classificar.', geral: false };
}
