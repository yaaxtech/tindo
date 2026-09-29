import { destinoInternoSeguro } from '@/lib/auth/redirect';
import type { EmailOtpType } from '@supabase/supabase-js';

const TIPOS_OTP: readonly EmailOtpType[] = [
  'magiclink',
  'recovery',
  'signup',
  'invite',
  'email',
  'email_change',
];

/** Códigos do Supabase quando o link é aberto num navegador diferente do que pediu o e-mail. */
const ERROS_DE_OUTRO_NAVEGADOR = ['bad_code_verifier', 'pkce_code_verifier_not_found'];

export type ErroDoLink = 'link-invalido' | 'link-outro-navegador';

interface AuthDoRetorno {
  exchangeCodeForSession(code: string): Promise<{ error: { code?: string } | null }>;
  verifyOtp(params: {
    type: EmailOtpType;
    token_hash: string;
  }): Promise<{ error: { code?: string } | null }>;
}

function ehTipoOtp(valor: string | null): valor is EmailOtpType {
  return Boolean(valor) && (TIPOS_OTP as readonly string[]).includes(valor as string);
}

/**
 * Trata a volta do e-mail de login/recuperação. Aceita os dois formatos:
 * - `code` (PKCE): só funciona no MESMO navegador que pediu o e-mail;
 * - `token_hash` + `type`: funciona em qualquer navegador/aparelho (ex.: link aberto
 *   no app de e-mail do iPhone), desde que o modelo de e-mail do Supabase use
 *   `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=<tipo>`.
 */
export async function tratarRetornoDoEmail(
  params: URLSearchParams,
  auth: AuthDoRetorno,
): Promise<{ ok: true; destino: string } | { ok: false; erro: ErroDoLink; destino: string }> {
  const tipo = params.get('type');
  const destinoPadrao = tipo === 'recovery' ? '/nova-senha' : '/docs';
  const destino = destinoInternoSeguro(params.get('next'), destinoPadrao);

  const tokenHash = params.get('token_hash');
  if (tokenHash && ehTipoOtp(tipo)) {
    const { error } = await auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) return { ok: true, destino };
    return { ok: false, erro: 'link-invalido', destino };
  }

  const code = params.get('code');
  if (code) {
    const { error } = await auth.exchangeCodeForSession(code);
    if (!error) return { ok: true, destino };
    const outroNavegador = ERROS_DE_OUTRO_NAVEGADOR.includes(error.code ?? '');
    return { ok: false, erro: outroNavegador ? 'link-outro-navegador' : 'link-invalido', destino };
  }

  return { ok: false, erro: 'link-invalido', destino };
}
