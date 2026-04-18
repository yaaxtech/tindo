'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-danger">Algo deu errado</p>
      <h1 className="mt-2 text-2xl font-semibold text-text-primary">Não foi possível carregar</h1>
      <p className="mt-1 max-w-md text-text-secondary">
        Tentamos de novo pode resolver. Se persistir, descreva o que aconteceu para nós.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-10 items-center justify-center rounded-md grad-jade px-6 font-medium text-text-inverse"
      >
        Tentar de novo
      </button>
    </main>
  );
}
