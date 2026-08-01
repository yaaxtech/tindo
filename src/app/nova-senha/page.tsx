'use client';

import { atualizarSenha } from '@/services/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NovaSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (senha !== confirmacao) return setErro('As senhas não coincidem.');
    setCarregando(true);
    try {
      await atualizarSenha(senha);
      router.replace('/docs');
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível atualizar a senha.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">Crie uma nova senha</h1>
        <p className="mt-2 text-sm text-text-secondary">Use pelo menos 8 caracteres.</p>
        <form onSubmit={salvar} className="mt-6 space-y-4">
          <div>
            <label
              className="mb-1 block text-xs uppercase tracking-wider text-text-muted"
              htmlFor="senha"
            >
              Nova senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
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
              onChange={(event) => setConfirmacao(event.target.value)}
              className="h-11 w-full rounded-md border border-border-strong bg-bg-elevated px-4 outline-none focus:border-jade-accent"
            />
          </div>
          {erro && (
            <p role="alert" className="text-sm text-danger">
              {erro}
            </p>
          )}
          <button
            type="submit"
            disabled={carregando}
            className="h-11 w-full rounded-md grad-jade font-medium text-text-inverse disabled:opacity-50"
          >
            {carregando ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </main>
  );
}
