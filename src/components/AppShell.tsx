'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';
import { Sidebar } from './Sidebar';

/** Rotas que devem renderizar sem nenhuma navegação (fluxo fullscreen). */
const FULLSCREEN_ROUTES = ['/login', '/cadastro', '/calibracao', '/recalibrar'];

function isFullscreen(pathname: string): boolean {
  return FULLSCREEN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  if (isFullscreen(pathname)) {
    return <>{children}</>;
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
          'pt-12 md:pt-0', // offset do MobileHeader em mobile
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
