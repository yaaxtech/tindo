'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';
import { Sidebar } from './Sidebar';

/** Rotas que devem renderizar sem nenhuma navegação (fluxo fullscreen). */
const FULLSCREEN_ROUTES = [
  '/',
  '/login',
  '/cadastro',
  '/recuperar-senha',
  '/nova-senha',
  '/calibracao',
  '/recalibrar',
];

/**
 * Rotas imersivas: o app ocupa a tela inteira e o menu do TinDo "existe mas não
 * existe" — sai do fluxo e vira uma gaveta acionada por um puxador na borda.
 * (RoadMapMind precisa da largura toda pro editor + mapa.)
 */
const IMMERSIVE_ROUTES = ['/docs'];

function matchRoute(routes: string[], pathname: string): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  if (matchRoute(FULLSCREEN_ROUTES, pathname)) {
    return <>{children}</>;
  }

  // Imersivo: sem sidebar empurrando, sem header/bottom-nav — só a gaveta.
  if (matchRoute(IMMERSIVE_ROUTES, pathname)) {
    return (
      <>
        <Sidebar immersive />
        <main className="min-h-dvh">{children}</main>
      </>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile top bar */}
      <MobileHeader />

      {/* Main content area */}
      <main
        className={[
          'md:pl-60', // offset da sidebar em desktop
          'pt-[var(--app-header-h)]', // offset do MobileHeader (zero em desktop)
          'pb-20 md:pb-0', // espaço pro BottomNav em mobile
          'min-h-dvh',
        ].join(' ')}
      >
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </>
  );
}
