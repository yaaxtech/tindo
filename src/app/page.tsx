import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full grad-jade shadow-glow">
          <span className="text-3xl font-bold text-text-inverse">T</span>
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-text-primary">
          Tin<span className="text-jade-accent">Do</span>
        </h1>
        <p className="mb-10 text-balance text-text-secondary">
          Produtividade uma tarefa por vez. Priorização por IA, recompensa neural na conclusão,
          gamificação que sustenta.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/cards"
            className="inline-flex h-12 items-center justify-center rounded-md grad-jade font-medium text-text-inverse transition-transform duration-fast ease-standard hover:scale-[1.02]"
          >
            Começar agora
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-md border border-border-strong bg-bg-elevated font-medium text-text-primary transition-colors hover:bg-bg-hover"
          >
            Entrar
          </Link>
        </div>

        <p className="mt-10 text-xs text-text-muted">v0.0.1 · Fase 0 · Foco, prazer, calibração.</p>
      </div>
    </main>
  );
}
