export type AcessoRota = 'publica' | 'autenticada' | 'tecnica';

/** Únicas páginas que continuarão públicas depois do corte definitivo. */
export const ROTAS_PUBLICAS = [
  '/',
  '/login',
  '/cadastro',
  '/auth/callback',
  '/recuperar-senha',
  '/nova-senha',
  '/manifest.webmanifest',
] as const;

/** Rotas sem sessão de usuário, protegidas por segredo próprio. */
export const ROTAS_TECNICAS = ['/api/cron/diario', '/api/push/disparar-gatilhos'] as const;

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
    ehRotaRoadMapMind(pathname) || pathname === '/api/perfil' || pathname.startsWith('/api/perfil/')
  );
}

export function podeAcessarRotaAutenticada(
  pathname: string,
  identidade: { usuarioId: string; email?: string | null },
  donoId?: string,
): boolean {
  if (ehRotaMultiusuario(pathname)) return true;
  return (
    (Boolean(donoId) && identidade.usuarioId === donoId) ||
    identidade.email?.toLowerCase() === 'falecomseucamarao@gmail.com'
  );
}

export function classificarAcessoRota(pathname: string): AcessoRota {
  if ((ROTAS_TECNICAS as readonly string[]).includes(pathname)) return 'tecnica';
  if ((ROTAS_PUBLICAS as readonly string[]).includes(pathname)) return 'publica';
  return 'autenticada';
}
