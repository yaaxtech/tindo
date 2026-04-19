'use client';

import { Layers, List, Settings, Sparkles, Trophy } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/cards', label: 'Cards', icon: Layers },
  { href: '/tarefas', label: 'Tarefas', icon: List },
  { href: '/sugestoes-ia', label: 'Sugestões', icon: Sparkles },
  { href: '/gamificacao', label: 'Streak', icon: Trophy },
  { href: '/configuracoes', label: 'Config', icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#121820] border-t border-[#1B222C] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch h-14">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={[
                  'relative flex flex-col items-center justify-center h-full gap-0.5 text-[10px] font-medium transition-colors',
                  active ? 'text-[#2CAF93]' : 'text-[#7A8796] hover:text-[#E8EDF2]',
                ].join(' ')}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-2 right-2 h-[2px] rounded-b bg-[#2CAF93]"
                  />
                )}
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
