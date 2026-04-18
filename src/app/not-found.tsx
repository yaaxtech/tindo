import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-text-primary">Página não encontrada</h1>
      <p className="mt-1 text-text-secondary">O link pode estar quebrado ou a rota não existe.</p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-md grad-jade px-6 font-medium text-text-inverse"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
