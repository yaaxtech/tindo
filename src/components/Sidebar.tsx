'use client';

import { useGamificacaoStore } from '@/stores/gamificacao';
import { motion } from 'framer-motion';
import {
  FolderTree,
  Inbox,
  Layers,
  ListTodo,
  RefreshCw,
  Settings,
  Sparkles,
  Tag,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/cards', label: 'Cards', icon: Layers },
  { href: '/sugestoes', label: 'Sugestões', icon: Sparkles },
  { href: '/sugestoes-ia', label: 'Inbox IA', icon: Inbox },
  { href: '/tarefas', label: 'Tarefas', icon: ListTodo },
  { href: '/gamificacao', label: 'Gamificação', icon: Trophy },
  { href: '/projetos', label: 'Projetos', icon: FolderTree },
  { href: '/tags', label: 'Tags', icon: Tag },
  { href: '/configuracoes/todoist/status', label: 'Todoist', icon: RefreshCw },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { streakAtual, nivel } = useGamificacaoStore();

  return (
    <aside
      aria-label="Navegação principal"
      className="hidden md:flex flex-col fixed top-0 left-0 bottom-0 w-60 z-40
        bg-bg-elevated border-r border-[#1B222C]
        pl-[env(safe-area-inset-left)]"
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-5 border-b border-[#1B222C] shrink-0">
        <span
          className="text-xl font-bold bg-gradient-to-r from-[#198B74] to-[#2CAF93] bg-clip-text text-transparent select-none"
          aria-label="TinDo"
        >
          TinDo
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Menu de navegação">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                    'transition-colors duration-150 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-[#198B74] focus-visible:ring-offset-1 focus-visible:ring-offset-[#121820]',
                    active
                      ? 'text-[#2CAF93] bg-[#198B74]/10'
                      : 'text-[#7A8796] hover:text-[#E8EDF2] hover:bg-[#1B222C]',
                  ].join(' ')}
                >
                  {/* Active left border */}
                  {active && (
                    <motion.span
                      layoutId="sidebar-active-border"
                      aria-hidden="true"
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#198B74]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon
                    size={18}
                    strokeWidth={active ? 2.2 : 1.8}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer badge: streak + nível */}
      <div className="shrink-0 px-4 py-3 border-t border-[#1B222C]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[#7A8796]">
            <Trophy size={13} aria-hidden="true" className="text-[#2CAF93]" />
            <span>
              Nível <span className="text-[#E8EDF2] font-semibold">{nivel}</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-[#7A8796]">
            <span aria-label={`${streakAtual} dias de streak`} className="flex items-center gap-1">
              🔥 <span className="text-[#E8EDF2] font-semibold">{streakAtual}d</span>
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
