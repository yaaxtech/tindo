import { UsuarioNaoAutenticadoError, exigirContextoAuth } from '@/lib/auth/server';
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
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function papelValido(valor: unknown): valor is Papel {
  return valor === 'leitor' || valor === 'editor';
}

function modoValido(valor: unknown): valor is ModoLink {
  return valor === 'restrito' || valor === 'publico_leitura';
}

function respostaErro(erro: unknown) {
  const mensagem =
    erro instanceof SyntaxError
      ? 'Não foi possível ler os dados enviados.'
      : erro instanceof Error
        ? erro.message
        : 'Erro inesperado ao compartilhar.';
  const status =
    erro instanceof UsuarioNaoAutenticadoError
      ? 401
      : erro instanceof SyntaxError
        ? 400
        : mensagem.includes('Só o dono')
          ? 403
          : mensagem.includes('não foi encontrado')
            ? 404
            : 500;
  return NextResponse.json({ erro: mensagem }, { status });
}

async function corpo(req: Request): Promise<Record<string, unknown>> {
  return (await req.json()) as Record<string, unknown>;
}

export async function GET(req: Request) {
  try {
    const documentoId = new URL(req.url).searchParams.get('documentoId');
    if (!documentoId) {
      return NextResponse.json({ erro: 'documentoId é obrigatório.' }, { status: 400 });
    }
    const contexto = await exigirContextoAuth();
    const [acessos, link, espelhosExternos] = await Promise.all([
      listarAcesso(contexto, documentoId),
      linkDoDocumento(contexto, documentoId),
      espelhosExternosDoDocumento(contexto, documentoId),
    ]);
    return NextResponse.json({ acessos, link, espelhosExternos });
  } catch (erro) {
    return respostaErro(erro);
  }
}

export async function POST(req: Request) {
  try {
    const dados = await corpo(req);
    if (
      typeof dados.documentoId !== 'string' ||
      typeof dados.email !== 'string' ||
      !dados.email.trim() ||
      !papelValido(dados.papel)
    ) {
      return NextResponse.json({ erro: 'Email e papel são obrigatórios.' }, { status: 400 });
    }
    const contexto = await exigirContextoAuth();
    return NextResponse.json(
      await convidarPorEmail(contexto, dados.documentoId, dados.email, dados.papel),
    );
  } catch (erro) {
    return respostaErro(erro);
  }
}

export async function PATCH(req: Request) {
  try {
    const dados = await corpo(req);
    if (
      typeof dados.documentoId !== 'string' ||
      typeof dados.usuarioId !== 'string' ||
      !papelValido(dados.papel)
    ) {
      return NextResponse.json(
        { erro: 'Documento, pessoa e papel são obrigatórios.' },
        {
          status: 400,
        },
      );
    }
    const contexto = await exigirContextoAuth();
    await trocarPapel(contexto, dados.documentoId, dados.usuarioId, dados.papel);
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return respostaErro(erro);
  }
}

export async function DELETE(req: Request) {
  try {
    const dados = await corpo(req);
    if (typeof dados.documentoId !== 'string' || typeof dados.usuarioId !== 'string') {
      return NextResponse.json({ erro: 'Documento e pessoa são obrigatórios.' }, { status: 400 });
    }
    const contexto = await exigirContextoAuth();
    await revogar(contexto, dados.documentoId, dados.usuarioId);
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return respostaErro(erro);
  }
}

export async function PUT(req: Request) {
  try {
    const dados = await corpo(req);
    if (typeof dados.documentoId !== 'string') {
      return NextResponse.json({ erro: 'documentoId é obrigatório.' }, { status: 400 });
    }
    const contexto = await exigirContextoAuth();
    if (dados.regenerar === true) {
      return NextResponse.json({ token: await regenerarToken(contexto, dados.documentoId) });
    }
    if (!modoValido(dados.modo)) {
      return NextResponse.json({ erro: 'Modo do link inválido.' }, { status: 400 });
    }
    return NextResponse.json({
      link: await definirModoLink(contexto, dados.documentoId, dados.modo),
    });
  } catch (erro) {
    return respostaErro(erro);
  }
}
