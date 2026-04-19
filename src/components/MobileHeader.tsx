'use client';

import { User } from 'lucide-react';
import Link from 'next/link';

export function MobileHeader() {
  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-40
        h-12 bg-bg-elevated border-b border-[#1B222C]
        pt-[env(safe-area-inset-top)]"
    >
      <div className="flex items-center justify-between h-full px-4">
        {/* Logo */}
        <span
          className="text-lg font-bold bg-gradient-to-r from-[#198B74] to-[#2CAF93] bg-clip-text text-transparent select-none"
          aria-label="TinDo"
        >
          TinDo
        </span>

        {/* Perfil */}
        <Link
          href="/configuracoes"
          aria-label="Configurações e perfil"
          className="flex items-center justify-center w-8 h-8 rounded-full
            text-[#7A8796] hover:text-[#E8EDF2] hover:bg-[#1B222C]
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#198B74]"
        >
          <User size={18} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
