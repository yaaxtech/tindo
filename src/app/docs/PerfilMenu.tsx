'use client';

import { CORES_PERFIL, type CorPerfil } from '@/lib/perfil/cores';
import { sair } from '@/services/auth';
import type { PerfilUsuario } from '@/services/perfil';
import { LogOut, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return `${partes[0]?.[0] ?? '?'}${partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : ''}`.toUpperCase();
}

export default function PerfilMenu() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cor, setCor] = useState<CorPerfil>(CORES_PERFIL[0]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/perfil')
      .then(async (resposta) => {
        const body = (await resposta.json()) as { perfil?: PerfilUsuario; erro?: string };
        if (!resposta.ok || !body.perfil) throw new Error(body.erro ?? 'Erro ao carregar perfil.');
        setPerfil(body.perfil);
        setNome(body.perfil.nome);
        setWhatsapp(body.perfil.whatsapp ?? '');
        setCor(body.perfil.cor);
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Erro ao carregar perfil.'));
  }, []);

  useEffect(() => {
    if (!aberto) return;
    function fecharFora(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', fecharFora);
    return () => document.removeEventListener('mousedown', fecharFora);
  }, [aberto]);

  async function salvarPerfil(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const resposta = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, whatsapp, cor }),
      });
      const body = (await resposta.json()) as { perfil?: PerfilUsuario; erro?: string };
      if (!resposta.ok || !body.perfil) throw new Error(body.erro ?? 'Erro ao salvar perfil.');
      setPerfil(body.perfil);
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar perfil.');
    } finally {
      setSalvando(false);
    }
  }

  async function encerrarSessao() {
    setErro(null);
    try {
      await sair();
      router.replace('/login');
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível sair.');
    }
  }

  return (
    <div className="rmm-perfil" ref={menuRef}>
      <button
        type="button"
        className="rmm-avatar"
        style={{ backgroundColor: perfil?.cor ?? '#4A5563' }}
        aria-label="Abrir perfil"
        title={perfil?.nome ?? 'Perfil'}
        aria-expanded={aberto}
        onClick={() => setAberto((valor) => !valor)}
      >
        {perfil ? iniciais(perfil.nome) : '…'}
      </button>

      {aberto && (
        <div className="rmm-perfil-menu">
          <div className="rmm-perfil-cabecalho">
            <div>
              <strong>Seu perfil</strong>
              <span>{perfil?.email}</span>
            </div>
            <button type="button" aria-label="Fechar perfil" onClick={() => setAberto(false)}>
              <X size={16} />
            </button>
          </div>

          <form onSubmit={salvarPerfil}>
            <label htmlFor="perfil-nome">Nome</label>
            <input
              id="perfil-nome"
              required
              maxLength={80}
              value={nome}
              onChange={(event) => setNome(event.target.value)}
            />

            <label htmlFor="perfil-whatsapp">
              WhatsApp <small>opcional</small>
            </label>
            <input
              id="perfil-whatsapp"
              type="tel"
              maxLength={30}
              placeholder="(00) 00000-0000"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
            />

            <fieldset>
              <legend>Cor do perfil</legend>
              <div className="rmm-paleta-perfil">
                {CORES_PERFIL.map((opcao) => (
                  <button
                    key={opcao}
                    type="button"
                    aria-label={`Usar cor ${opcao}`}
                    aria-pressed={cor === opcao}
                    className={cor === opcao ? 'selecionada' : ''}
                    style={{ backgroundColor: opcao }}
                    onClick={() => setCor(opcao)}
                  />
                ))}
              </div>
            </fieldset>

            {erro && (
              <p className="rmm-perfil-erro" role="alert">
                {erro}
              </p>
            )}
            <button type="submit" className="rmm-perfil-salvar" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar perfil'}
            </button>
          </form>

          <button type="button" className="rmm-perfil-sair" onClick={() => void encerrarSessao()}>
            <LogOut size={15} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}
