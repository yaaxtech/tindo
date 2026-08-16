import { respostaOk } from '@/lib/api/resposta';
import Anthropic from '@anthropic-ai/sdk';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

interface TestarPayload {
  chave?: string;
  apiKey?: string;
}

interface TestarResponse {
  ok: boolean;
  detalhe: string;
}

/**
 * EXCEÇÃO CONSCIENTE ao envelope `{ erro, codigo }`: esta rota não reporta um
 * erro da aplicação, e sim o RESULTADO de um teste de conexão. Falhar em falar
 * com a Claude é a resposta esperada aqui, não uma falha da rota — por isso o
 * catch devolve 200 com `{ ok: false, detalhe }`, que é o que a tela de
 * /configuracoes lê. Não converter para `rotaApi`.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TestarPayload;
    const chave = (body.chave ?? body.apiKey ?? '').trim();

    if (!chave) {
      return respostaOk<TestarResponse>({ ok: false, detalhe: 'Chave não informada' }, 400);
    }
    if (!chave.startsWith('sk-ant-')) {
      return respostaOk<TestarResponse>(
        { ok: false, detalhe: 'A chave deve começar com sk-ant-' },
        400,
      );
    }
    if (chave.length < 20) {
      return respostaOk<TestarResponse>(
        { ok: false, detalhe: `Chave muito curta (${chave.length} chars — mínimo 20)` },
        400,
      );
    }

    const anthropic = new Anthropic({ apiKey: chave });
    await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });

    return respostaOk<TestarResponse>({
      ok: true,
      detalhe: 'Chave válida — conexão bem-sucedida.',
    });
  } catch (err) {
    console.error('/api/ai/testar error:', err);
    let detalhe = 'Chave inválida ou sem permissão. Verifique em console.anthropic.com.';
    if (err instanceof Anthropic.AuthenticationError) {
      detalhe = 'Chave da API inválida. Verifique e tente novamente.';
    } else if (err instanceof Anthropic.RateLimitError) {
      detalhe = 'Limite de requisições atingido. Aguarde um momento.';
    } else if (err instanceof Anthropic.APIConnectionError) {
      detalhe = 'Não foi possível conectar à API Claude. Verifique sua conexão.';
    }
    return respostaOk<TestarResponse>({ ok: false, detalhe }, 200);
  }
}
