'use client';

import { emailDaSessao, sair } from '@/services/auth';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function AvisoAcessoRestrito() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const de = searchParams.get('de');
  const [email, setEmail] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    emailDaSessao()
      .then(setEmail)
      .catch(() => setEmail(null));
  }, []);

  async function trocarDeConta() {
    setSaindo(true);
    try {
      await sair();
    } finally {
      const login = new URL('/login', window.location.origin);
      if (de?.startsWith('/')) login.searchParams.set('next', de);
      router.replace(`${login.pathname}${login.search}`);
      router.refresh();
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">Esta área ainda não abre nesta conta</h1>
        <p className="mt-3 text-sm text-text-secondary">
          {email ? (
            <>
              Você entrou como <strong className="text-text-primary">{email}</strong>.{' '}
            </>
          ) : null}
          Cards, Tarefas, Projetos, Tags e Todoist ainda funcionam só na conta principal do TinDo, a
          que está ligada ao seu Todoist. Por isso o menu levava você de volta ao RoadMapMind.
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Saia e entre com a conta principal para usar essas telas.
        </p>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={trocarDeConta}
            disabled={saindo}
            className="h-11 w-full rounded-md grad-jade font-medium text-text-inverse disabled:opacity-50"
          >
            {saindo ? 'Saindo…' : 'Entrar com outra conta'}
          </button>
          <Link
            href="/docs"
            className="flex h-11 w-full items-center justify-center rounded-md border border-border-strong bg-bg-elevated text-sm font-medium text-text-primary hover:border-jade-accent"
          >
            Continuar no RoadMapMind
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function AcessoRestritoPage() {
  return (
    <Suspense>
      <AvisoAcessoRestrito />
    </Suspense>
  );
}
