import Anthropic from '@anthropic-ai/sdk';
import { type NextRequest, NextResponse } from 'next/server';

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

export async function POST(request: NextRequest): Promise<NextResponse<TestarResponse>> {
  try {
    const body = (await request.json()) as TestarPayload;
    const chave = (body.chave ?? body.apiKey ?? '').trim();

    if (!chave) {
      return NextResponse.json({ ok: false, detalhe: 'Chave não informada' }, { status: 400 });
    }
    if (!chave.startsWith('sk-ant-')) {
      return NextResponse.json(
        { ok: false, detalhe: 'A chave deve começar com sk-ant-' },
        { status: 400 },
      );
    }
    if (chave.length < 20) {
      return NextResponse.json(
        { ok: false, detalhe: `Chave muito curta (${chave.length} chars — mínimo 20)` },
        { status: 400 },
      );
    }

    const anthropic = new Anthropic({ apiKey: chave });
    await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });

    return NextResponse.json({ ok: true, detalhe: 'Chave válida — conexão bem-sucedida.' });
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
    return NextResponse.json({ ok: false, detalhe }, { status: 200 });
  }
}
