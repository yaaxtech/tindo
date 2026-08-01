'use client';

import { Turnstile, turnstileConfigurado } from '@/components/auth/Turnstile';
import { solicitarRecuperacaoDeSenha } from '@/services/auth';
import Link from 'next/link';
import { useCallback, useState } from 'react';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [resetCaptcha, setResetCaptcha] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const receberToken = useCallback((token: string | null) => setCaptchaToken(token), []);

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await solicitarRecuperacaoDeSenha(email, captchaToken ?? undefined);
      setEnviado(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar o e-mail.');
      setResetCaptcha((valor) => valor + 1);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">Recuperar senha</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Enviaremos um link para você criar uma nova senha.
        </p>
        {enviado ? (
          <div className="mt-6 rounded-md border border-jade-accent/40 bg-jade-dim/30 p-4 text-sm text-jade-accent">
            Se existe uma conta para <strong>{email}</strong>, o e-mail chegará em instantes.
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-6 space-y-4">
            <div>
              <label
                className="mb-1 block text-xs uppercase tracking-wider text-text-muted"
                htmlFor="email"
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-md border border-border-strong bg-bg-elevated px-4 outline-none focus:border-jade-accent"
              />
            </div>
            <Turnstile key={resetCaptcha} onToken={receberToken} />
            {erro && (
              <p role="alert" className="text-sm text-danger">
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={carregando || (turnstileConfigurado && !captchaToken)}
              className="h-11 w-full rounded-md grad-jade font-medium text-text-inverse disabled:opacity-50"
            >
              {carregando ? 'Enviando…' : 'Enviar link de recuperação'}
            </button>
          </form>
        )}
        <p className="mt-8 text-center text-sm">
          <Link href="/login" className="text-jade-accent hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  );
}
