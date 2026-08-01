'use client';

import { Turnstile, turnstileConfigurado } from '@/components/auth/Turnstile';
import { destinoInternoSeguro } from '@/lib/auth/redirect';
import { entrarComSenha, enviarLinkMagico } from '@/services/auth';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destino = destinoInternoSeguro(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [resetCaptcha, setResetCaptcha] = useState(0);
  const [carregando, setCarregando] = useState<'senha' | 'link' | null>(null);
  const [linkEnviado, setLinkEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(
    searchParams.get('erro') === 'link-invalido'
      ? 'Este link expirou ou já foi usado. Peça um novo link.'
      : null,
  );
  const receberToken = useCallback((token: string | null) => setCaptchaToken(token), []);
  const bloqueadoPorCaptcha = turnstileConfigurado && !captchaToken;

  async function entrar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    setCarregando('senha');
    try {
      await entrarComSenha(email, senha, captchaToken ?? undefined);
      router.replace(destino);
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível entrar.');
      setResetCaptcha((valor) => valor + 1);
    } finally {
      setCarregando(null);
    }
  }

  async function enviarLink() {
    setErro(null);
    if (!email.trim()) {
      setErro('Informe seu e-mail primeiro.');
      return;
    }
    setCarregando('link');
    try {
      await enviarLinkMagico(email, destino, captchaToken ?? undefined);
      setLinkEnviado(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar o link.');
      setResetCaptcha((valor) => valor + 1);
    } finally {
      setCarregando(null);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full grad-jade shadow-glow">
            <span className="text-xl font-bold text-text-inverse">T</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Entrar no TinDo</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Use sua senha ou receba um link mágico.
          </p>
        </div>

        {linkEnviado ? (
          <div className="space-y-4 text-center">
            <div className="rounded-md border border-jade-accent/40 bg-jade-dim/30 p-4 text-sm text-jade-accent">
              Se existe uma conta para <strong>{email}</strong>, o link chegará em instantes.
            </div>
            <button
              type="button"
              className="text-sm text-text-secondary hover:text-text-primary"
              onClick={() => setLinkEnviado(false)}
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <form onSubmit={entrar} className="space-y-4">
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
                placeholder="seu@email.com"
                className="h-11 w-full rounded-md border border-border-strong bg-bg-elevated px-4 text-text-primary outline-none focus:border-jade-accent"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider text-text-muted" htmlFor="senha">
                  Senha
                </label>
                <Link href="/recuperar-senha" className="text-xs text-jade-accent hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                className="h-11 w-full rounded-md border border-border-strong bg-bg-elevated px-4 text-text-primary outline-none focus:border-jade-accent"
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
              disabled={Boolean(carregando) || bloqueadoPorCaptcha}
              className="h-11 w-full rounded-md grad-jade font-medium text-text-inverse disabled:cursor-not-allowed disabled:opacity-50"
            >
              {carregando === 'senha' ? 'Entrando…' : 'Entrar com senha'}
            </button>

            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="h-px flex-1 bg-border-strong" />
              <span>ou</span>
              <span className="h-px flex-1 bg-border-strong" />
            </div>
            <button
              type="button"
              onClick={enviarLink}
              disabled={Boolean(carregando) || bloqueadoPorCaptcha}
              className="h-11 w-full rounded-md border border-border-strong bg-bg-elevated font-medium text-text-primary hover:border-jade-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {carregando === 'link' ? 'Enviando…' : 'Receber link mágico'}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-text-muted">
          <Link href="/" className="hover:text-text-primary">
            ← Voltar
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
