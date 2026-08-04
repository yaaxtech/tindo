'use client';

import { Turnstile, turnstileConfigurado } from '@/components/auth/Turnstile';
import { cadastrarComSenha } from '@/services/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

const PAISES_DDI = [
  { ddi: '55', nome: 'Brasil', bandeira: '🇧🇷' },
  { ddi: '1', nome: 'Estados Unidos e Canadá', bandeira: '🇺🇸' },
  { ddi: '351', nome: 'Portugal', bandeira: '🇵🇹' },
  { ddi: '54', nome: 'Argentina', bandeira: '🇦🇷' },
  { ddi: '57', nome: 'Colômbia', bandeira: '🇨🇴' },
  { ddi: '52', nome: 'México', bandeira: '🇲🇽' },
  { ddi: '34', nome: 'Espanha', bandeira: '🇪🇸' },
] as const;

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [ddi, setDdi] = useState('55');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [resetCaptcha, setResetCaptcha] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [confirmarEmail, setConfirmarEmail] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const receberToken = useCallback((token: string | null) => setCaptchaToken(token), []);

  function whatsappComDdi(valor: string, codigoDdi: string): string | undefined {
    const texto = valor.trim();
    const numeros = texto.replace(/\D/g, '');
    const numeroNacional =
      texto.startsWith(`+${codigoDdi}`) || texto.startsWith(`00${codigoDdi}`)
        ? numeros.replace(new RegExp(`^(?:00)?${codigoDdi}`), '')
        : numeros;
    return numeroNacional ? `+${codigoDdi}${numeroNacional}` : undefined;
  }

  async function cadastrar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    if (nome.trim().length < 2) return setErro('Informe seu nome.');
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (senha !== confirmacao) return setErro('As senhas não coincidem.');

    setCarregando(true);
    try {
      const resultado = await cadastrarComSenha(
        { nome, email, senha, whatsapp: whatsappComDdi(whatsapp, ddi) },
        captchaToken ?? undefined,
      );
      if (resultado.sessaoCriada) {
        router.replace('/docs');
        router.refresh();
      } else {
        setConfirmarEmail(true);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar sua conta.');
      setResetCaptcha((valor) => valor + 1);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full grad-jade shadow-glow">
            <span className="text-xl font-bold text-text-inverse">T</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Criar conta no TinDo</h1>
          <p className="mt-1 text-sm text-text-secondary">Comece pelo RoadMapMind.</p>
        </div>

        {confirmarEmail ? (
          <div className="space-y-5 text-center">
            <div className="rounded-md border border-jade-accent/40 bg-jade-dim/30 p-4 text-sm text-jade-accent">
              Por segurança, não informamos se <strong>{email}</strong> já tinha uma conta. Se for
              um cadastro novo e o envio estiver disponível, a confirmação chegará por e-mail.
            </div>
            <div className="flex justify-center gap-5 text-sm">
              <Link href="/login" className="text-jade-accent hover:underline">
                Ir para o login
              </Link>
              <Link href="/recuperar-senha" className="text-jade-accent hover:underline">
                Recuperar senha
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={cadastrar} className="space-y-3">
            <div>
              <label
                className="mb-1 block text-xs uppercase tracking-wider text-text-muted"
                htmlFor="nome"
              >
                Nome
              </label>
              <input
                id="nome"
                autoComplete="name"
                required
                maxLength={80}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="h-11 w-full rounded-md border border-border-strong bg-bg-elevated px-4 outline-none focus:border-jade-accent"
              />
            </div>
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
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-md border border-border-strong bg-bg-elevated px-4 outline-none focus:border-jade-accent"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs uppercase tracking-wider text-text-muted"
                htmlFor="whatsapp"
              >
                WhatsApp <span className="normal-case text-text-muted">(opcional)</span>
              </label>
              <div className="flex h-11 overflow-hidden rounded-md border border-border-strong bg-bg-elevated focus-within:border-jade-accent">
                <select
                  aria-label="País e código telefônico"
                  value={ddi}
                  onChange={(event) => setDdi(event.target.value)}
                  className="max-w-32 border-r border-border-strong bg-bg-elevated px-3 text-sm text-text-secondary outline-none"
                >
                  {PAISES_DDI.map((pais) => (
                    <option key={pais.ddi} value={pais.ddi}>
                      {pais.bandeira} +{pais.ddi} · {pais.nome}
                    </option>
                  ))}
                </select>
                <input
                  id="whatsapp"
                  type="tel"
                  autoComplete="tel-national"
                  maxLength={20}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="min-w-0 flex-1 bg-transparent px-4 outline-none"
                />
              </div>
            </div>
            <div>
              <label
                className="mb-1 block text-xs uppercase tracking-wider text-text-muted"
                htmlFor="senha"
              >
                Senha
              </label>
              <input
                id="senha"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-11 w-full rounded-md border border-border-strong bg-bg-elevated px-4 outline-none focus:border-jade-accent"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs uppercase tracking-wider text-text-muted"
                htmlFor="confirmacao"
              >
                Repita a senha
              </label>
              <input
                id="confirmacao"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
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
              className="mt-2 h-11 w-full rounded-md grad-jade font-medium text-text-inverse disabled:cursor-not-allowed disabled:opacity-50"
            >
              {carregando ? 'Criando conta…' : 'Criar conta'}
            </button>
          </form>
        )}

        <p className="mt-7 text-center text-sm text-text-muted">
          Já tem uma conta?{' '}
          <Link href="/login" className="text-jade-accent hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
