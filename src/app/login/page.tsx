'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    // TODO: Fase 0 — conectar com supabase.auth.signInWithOtp({ email })
    // MVP: só finge que deu certo
    setEnviado(true);
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full grad-jade shadow-glow">
            <span className="text-xl font-bold text-text-inverse">T</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Entrar no TinDo</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Te enviamos um link mágico para o email.
          </p>
        </div>

        {enviado ? (
          <div className="rounded-md border border-jade-accent/40 bg-jade-dim/30 p-4 text-center text-sm text-jade-accent">
            Link enviado para <strong>{email}</strong>. Abra no seu celular para entrar.
          </div>
        ) : (
          <form onSubmit={handleEnviar} className="space-y-3">
            <label className="block text-xs uppercase tracking-wider text-text-muted" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="h-11 w-full rounded-md border border-border-strong bg-bg-elevated px-4 text-text-primary outline-none focus:border-jade-accent"
            />
            {erro && <p className="text-xs text-danger">{erro}</p>}
            <button
              type="submit"
              className="h-11 w-full rounded-md grad-jade font-medium text-text-inverse"
            >
              Enviar link
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-text-muted">
          <Link href="/" className="hover:text-text-primary">← Voltar</Link>
        </p>
      </div>
    </main>
  );
}
