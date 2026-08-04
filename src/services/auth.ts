import { destinoInternoSeguro } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/client';

type AuthClient = ReturnType<typeof createClient>;

export class ErroDeAutenticacao extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroDeAutenticacao';
  }
}

function cliente(cliente?: AuthClient): AuthClient {
  return cliente ?? createClient();
}

function origemDoApp(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export function urlDeCallback(destino: string, origem = origemDoApp()): string {
  const url = new URL('/auth/callback', origem);
  url.searchParams.set('next', destinoInternoSeguro(destino));
  return url.toString();
}

function mensagemDoErro(codigo?: string): string {
  if (codigo === 'invalid_credentials') return 'E-mail ou senha inválidos.';
  if (codigo === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar.';
  if (codigo?.includes('captcha')) return 'Não foi possível validar o desafio anti-robô.';
  if (codigo?.includes('rate_limit') || codigo === 'over_email_send_rate_limit') {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  return 'Não foi possível concluir agora. Tente novamente.';
}

function falhar(error: { code?: string } | null): void {
  if (error) throw new ErroDeAutenticacao(mensagemDoErro(error.code));
}

function erroDeEmailDeveSerNeutro(error: { code?: string } | null): boolean {
  return (
    error?.code === 'user_not_found' ||
    error?.code === 'invalid_credentials' ||
    error?.code === 'email_address_not_authorized' ||
    error?.code === 'otp_disabled'
  );
}

export async function entrarComSenha(
  email: string,
  senha: string,
  captchaToken?: string,
  authClient?: AuthClient,
): Promise<void> {
  const { error } = await cliente(authClient).auth.signInWithPassword({
    email: email.trim(),
    password: senha,
    options: { captchaToken },
  });
  falhar(error);
}

export async function cadastrarComSenha(
  entrada: { nome: string; email: string; senha: string; whatsapp?: string },
  captchaToken?: string,
  authClient?: AuthClient,
): Promise<{ sessaoCriada: boolean }> {
  const { data, error } = await cliente(authClient).auth.signUp({
    email: entrada.email.trim(),
    password: entrada.senha,
    options: {
      emailRedirectTo: urlDeCallback('/docs'),
      captchaToken,
      data: {
        name: entrada.nome.trim(),
        whatsapp: entrada.whatsapp?.trim() || null,
      },
    },
  });
  // O Supabase devolve sucesso neutro para conta existente. Falhas do remetente
  // também ficam neutras para não permitir descobrir quais e-mails têm conta.
  if (erroDeEmailDeveSerNeutro(error)) return { sessaoCriada: false };
  falhar(error);
  return { sessaoCriada: Boolean(data.session) };
}

export async function enviarLinkMagico(
  email: string,
  destino: string,
  captchaToken?: string,
  authClient?: AuthClient,
): Promise<void> {
  const { error } = await cliente(authClient).auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: urlDeCallback(destino),
      captchaToken,
    },
  });
  // Mantém a resposta indistinguível para não revelar quais e-mails têm conta.
  if (erroDeEmailDeveSerNeutro(error)) return;
  falhar(error);
}

export async function solicitarRecuperacaoDeSenha(
  email: string,
  captchaToken?: string,
  authClient?: AuthClient,
): Promise<void> {
  const { error } = await cliente(authClient).auth.resetPasswordForEmail(email.trim(), {
    redirectTo: urlDeCallback('/nova-senha'),
    captchaToken,
  });
  // Mantém a resposta indistinguível para não revelar quais e-mails têm conta.
  if (erroDeEmailDeveSerNeutro(error)) return;
  falhar(error);
}

export async function atualizarSenha(senha: string, authClient?: AuthClient): Promise<void> {
  const { error } = await cliente(authClient).auth.updateUser({ password: senha });
  falhar(error);
}

export async function sair(authClient?: AuthClient): Promise<void> {
  const { error } = await cliente(authClient).auth.signOut();
  falhar(error);
}
