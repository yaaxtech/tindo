export type AcessoRota = 'publica' | 'autenticada' | 'tecnica';

/** Únicas páginas que continuarão públicas depois do corte definitivo. */
export const ROTAS_PUBLICAS = [
  '/',
  '/login',
  '/cadastro',
  '/auth/callback',
  '/recuperar-senha',
  '/nova-senha',
  '/harness',
  '/harness.json',
  '/manifest.webmanifest',
] as const;

/** Rotas sem sessão de usuário, protegidas por segredo próprio. */
export const ROTAS_TECNICAS = ['/api/cron/diario', '/api/push/disparar-gatilhos'] as const;

/**
 * Link público só-leitura por token (Fatia 5): página e API abertas SEM login.
 * A segurança fica no banco — as RPCs anônimas só devolvem doc `publico_leitura`.
 * Singular (`/compartilhado/`) ≠ rota autenticada do convidado (`/compartilhados/`).
 */
export function ehRotaCompartilhamentoPublico(pathname: string): boolean {
  return (
    pathname.startsWith('/docs/compartilhado/') || pathname.startsWith('/api/docs/compartilhado/')
  );
}

/** Fatia já migrada para autenticação real; demais rotas entram em PRs posteriores. */
export function ehRotaRoadMapMind(pathname: string): boolean {
  return (
    pathname === '/docs' ||
    pathname.startsWith('/docs/') ||
    pathname === '/api/docs' ||
    pathname.startsWith('/api/docs/')
  );
}

/** Áreas que já isolam dados pela sessão/RLS e podem receber qualquer conta. */
export function ehRotaMultiusuario(pathname: string): boolean {
  return (
    ehRotaRoadMapMind(pathname) ||
    pathname === '/acesso-restrito' ||
    pathname === '/api/perfil' ||
    pathname.startsWith('/api/perfil/')
  );
}

export const EMAIL_DONO_PADRAO = 'falecomseucamarao@gmail.com';

/** Lê `TINDO_DONO_EMAILS` (separados por vírgula) somando ao e-mail padrão do dono. */
export function emailsDoDono(valor?: string | null): string[] {
  const extras = (valor ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return [EMAIL_DONO_PADRAO, ...extras];
}

export function podeAcessarRotaAutenticada(
  pathname: string,
  identidade: { usuarioId: string; email?: string | null },
  donoId?: string,
  emailsDono: string[] = [EMAIL_DONO_PADRAO],
): boolean {
  if (ehRotaMultiusuario(pathname)) return true;
  const email = identidade.email?.trim().toLowerCase();
  return (
    (Boolean(donoId) && identidade.usuarioId === donoId) ||
    (Boolean(email) && emailsDono.includes(email as string))
  );
}

export function classificarAcessoRota(pathname: string): AcessoRota {
  if ((ROTAS_TECNICAS as readonly string[]).includes(pathname)) return 'tecnica';
  if ((ROTAS_PUBLICAS as readonly string[]).includes(pathname)) return 'publica';
  if (ehRotaCompartilhamentoPublico(pathname)) return 'publica';
  return 'autenticada';
}
