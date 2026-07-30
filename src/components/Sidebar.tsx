'use client';

import { useGamificacaoStore } from '@/stores/gamificacao';
import { motion } from 'framer-motion';
import {
  Briefcase,
  FolderTree,
  Inbox,
  Layers,
  ListTodo,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings,
  Sparkles,
  Tag,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { href: '/cards', label: 'Cards', icon: Layers },
  { href: '/sugestoes', label: 'Sugestões', icon: Sparkles },
  { href: '/sugestoes-ia', label: 'Inbox IA', icon: Inbox },
  { href: '/tarefas', label: 'Tarefas', icon: ListTodo },
  { href: '/gamificacao', label: 'Gamificação', icon: Trophy },
  { href: '/espacos-trabalho', label: 'Espaços de Trabalho', icon: Briefcase },
  { href: '/projetos', label: 'Projetos', icon: FolderTree },
  { href: '/docs', label: 'RoadMapMind', icon: Network },
  { href: '/tags', label: 'Tags', icon: Tag },
  { href: '/configuracoes/todoist', label: 'Todoist', icon: RefreshCw },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
] as const;

interface SidebarProps {
  /**
   * Modo imersivo (ex.: RoadMapMind em /docs): o menu não ocupa espaço na tela —
   * fica recolhido atrás de um puxador na borda e desliza por cima quando aberto.
   */
  immersive?: boolean;
}

export function Sidebar({ immersive = false }: SidebarProps) {
  const pathname = usePathname();
  const { streakAtual, nivel } = useGamificacaoStore();
  const [aberta, setAberta] = useState(false);

  // no imersivo: Esc fecha a gaveta
  useEffect(() => {
    if (!immersive || !aberta) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberta(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [immersive, aberta]);

  const miolo = (
    <>
      {/* Logo (+ botão de recolher no modo imersivo) */}
      <div className="flex items-center justify-between h-14 px-5 border-b border-[#1B222C] shrink-0">
        <span
          className="text-xl font-bold bg-gradient-to-r from-[#198B74] to-[#2CAF93] bg-clip-text text-transparent select-none"
          aria-label="TinDo"
        >
          TinDo
        </span>
        {immersive && (
          <button
            type="button"
            aria-label="Recolher menu"
            title="Recolher menu"
            onClick={() => setAberta(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[#7A8796]
              hover:text-[#2CAF93] hover:bg-[#1B222C] transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#198B74]"
          >
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
        )}
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
                  onClick={() => setAberta(false)}
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
                      layoutId={immersive ? 'sidebar-active-border-imm' : 'sidebar-active-border'}
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
    </>
  );

  // ---- modo normal: barra fixa que empurra o conteúdo (só desktop) ----
  if (!immersive) {
    return (
      <aside
        aria-label="Navegação principal"
        className="hidden md:flex flex-col fixed top-0 left-0 bottom-0 w-60 z-40
          bg-bg-elevated border-r border-[#1B222C]
          pl-[env(safe-area-inset-left)]"
      >
        {miolo}
      </aside>
    );
  }

  // ---- modo imersivo: o menu "existe mas não existe" ----
  // Recolhido, só o puxador na borda. Aberto, desliza por cima com backdrop.
  return (
    <>
      {/* Puxador na borda esquerda — some enquanto a gaveta está aberta */}
      {!aberta && (
        <button
          type="button"
          aria-label="Abrir menu do TinDo"
          title="Menu do TinDo"
          onClick={() => setAberta(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-40
            flex items-center justify-center w-6 h-16 rounded-r-xl
            bg-bg-elevated/90 backdrop-blur border border-l-0 border-[#1B222C]
            text-[#7A8796] hover:w-8 hover:text-[#2CAF93] hover:border-[#2CAF93]/40
            transition-all duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#198B74]
            pl-[env(safe-area-inset-left)]"
        >
          <PanelLeftOpen size={16} aria-hidden="true" />
        </button>
      )}

      {/* Backdrop (fecha ao clicar fora) */}
      {aberta && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setAberta(false)}
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] cursor-default"
        />
      )}

      {/* Gaveta */}
      <aside
        aria-label="Navegação principal"
        aria-hidden={!aberta}
        className={[
          'fixed top-0 left-0 bottom-0 w-60 z-50 flex flex-col',
          'bg-bg-elevated border-r border-[#1B222C]',
          'pl-[env(safe-area-inset-left)]',
          'shadow-[8px_0_40px_rgba(0,0,0,0.45)]',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          aberta ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {miolo}
      </aside>
    </>
  );
}
