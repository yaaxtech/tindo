'use client';

import type { AcessoItem, LinkDocumento, ModoLink, Papel } from '@/types/compartilhar';
import { Check, Copy, Globe, Link2, Lock, RotateCw, Share2, Trash2, Users, X } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  documentoId: string;
  titulo: string;
  tema: 'dark' | 'light';
  onFechar: () => void;
}

interface RespostaInicial {
  acessos: AcessoItem[];
  link: LinkDocumento;
}

async function chamarApi<T>(metodo: string, corpo?: unknown, query = ''): Promise<T> {
  const resposta = await fetch(`/api/docs/compartilhar${query}`, {
    method: metodo,
    headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const dados = (await resposta.json()) as T & { erro?: string };
  if (!resposta.ok) throw new Error(dados.erro ?? 'Não foi possível atualizar o compartilhamento.');
  return dados;
}

function inicial(item: AcessoItem): string {
  return (item.nome?.trim() || item.email)[0]?.toUpperCase() ?? '?';
}

function useFormValidation() {
  const emailRef = useRef<HTMLInputElement>(null);
  const [emailInvalido, setEmailInvalido] = useState(false);

  const validarEmail = (valor: string) => {
    const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
    setEmailInvalido(!valido);
    if (!valido) {
      emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      emailRef.current?.focus();
    }
    return valido;
  };

  return { emailRef, emailInvalido, setEmailInvalido, validarEmail };
}

function SeletorPapel({
  valor,
  disabled,
  onChange,
}: {
  valor: Papel;
  disabled?: boolean;
  onChange: (papel: Papel) => void;
}) {
  return (
    <select
      className="rmm-share-papel"
      value={valor}
      disabled={disabled}
      aria-label="Papel de acesso"
      onChange={(evento) => onChange(evento.target.value as Papel)}
    >
      <option value="leitor">Pode ver</option>
      <option value="editor">Pode editar</option>
    </select>
  );
}

export default function ModalCompartilhar({ documentoId, titulo, tema, onFechar }: Props) {
  const [montado, setMontado] = useState(false);
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Papel>('editor');
  const [acessos, setAcessos] = useState<AcessoItem[]>([]);
  const [link, setLink] = useState<LinkDocumento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falhaCarga, setFalhaCarga] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const { emailRef, emailInvalido, setEmailInvalido, validarEmail } = useFormValidation();

  const carregar = useCallback(async () => {
    const dados = await chamarApi<RespostaInicial>(
      'GET',
      undefined,
      `?documentoId=${encodeURIComponent(documentoId)}`,
    );
    setAcessos(dados.acessos);
    setLink(dados.link);
  }, [documentoId]);

  useEffect(() => {
    setMontado(true);
    void carregar()
      .catch((e: unknown) => {
        setFalhaCarga(true);
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar os acessos.');
      })
      .finally(() => setCarregando(false));
  }, [carregar]);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const convidar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (ocupado || !validarEmail(email)) return;
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const resultado = await chamarApi<{ status: 'concedido' | 'pendente' | 'ja_tem' | 'auto' }>(
        'POST',
        { documentoId, email, papel },
      );
      if (resultado.status === 'pendente') {
        setAviso(
          'Este email ainda não tem uma conta no TinDo. O envio de convite ainda não está disponível.',
        );
      } else if (resultado.status === 'auto') {
        setAviso('Você já é o dono deste documento.');
      } else {
        setAviso(
          resultado.status === 'ja_tem'
            ? 'A pessoa já tinha acesso; o papel foi atualizado.'
            : 'Acesso concedido. O documento já aparece para essa pessoa.',
        );
        setEmail('');
        setEmailInvalido(false);
        try {
          await carregar();
        } catch {
          setErro(
            'O acesso foi concedido, mas a lista não atualizou. Feche e abra esta janela novamente.',
          );
        }
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível convidar esta pessoa.');
    } finally {
      setOcupado(false);
    }
  };

  const mudarPapel = async (item: AcessoItem, novoPapel: Papel) => {
    if (!item.usuarioId) return;
    const anterior = item.papel;
    setAcessos((atuais) =>
      atuais.map((acesso) =>
        acesso.usuarioId === item.usuarioId ? { ...acesso, papel: novoPapel } : acesso,
      ),
    );
    setErro(null);
    try {
      await chamarApi('PATCH', { documentoId, usuarioId: item.usuarioId, papel: novoPapel });
    } catch (e) {
      setAcessos((atuais) =>
        atuais.map((acesso) =>
          acesso.usuarioId === item.usuarioId ? { ...acesso, papel: anterior } : acesso,
        ),
      );
      setErro(e instanceof Error ? e.message : 'Não foi possível trocar o papel.');
    }
  };

  const remover = async (item: AcessoItem) => {
    if (!item.usuarioId) return;
    setOcupado(true);
    setErro(null);
    try {
      await chamarApi('DELETE', { documentoId, usuarioId: item.usuarioId });
      setAcessos((atuais) => atuais.filter((acesso) => acesso.usuarioId !== item.usuarioId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível remover este acesso.');
    } finally {
      setOcupado(false);
    }
  };

  const mudarModo = async (modo: ModoLink) => {
    const anterior = link;
    if (link) setLink({ ...link, modo });
    setErro(null);
    try {
      const dados = await chamarApi<{ link: LinkDocumento }>('PUT', { documentoId, modo });
      setLink(dados.link);
    } catch (e) {
      setLink(anterior);
      setErro(e instanceof Error ? e.message : 'Não foi possível mudar o acesso geral.');
    }
  };

  const regenerar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const dados = await chamarApi<{ token: string }>('PUT', { documentoId, regenerar: true });
      setLink((atual) => (atual ? { ...atual, token: dados.token } : atual));
      setAviso('Novo link criado. O link anterior deixou de funcionar.');
      setCopiado(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar um novo link.');
    } finally {
      setOcupado(false);
    }
  };

  const copiarLink = async () => {
    if (!link) return;
    try {
      const url = `${window.location.origin}/docs/compartilhado/${link.token}`;
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      setErro('Não foi possível copiar o link. Copie pela barra do navegador.');
    }
  };

  if (!montado) return null;

  const publico = link?.modo === 'publico_leitura';
  return createPortal(
    <div
      className={`rmm-share-portal rmm-tema-${tema}`}
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onFechar();
      }}
    >
      <dialog open className="rmm-share-modal" aria-labelledby="rmm-share-titulo">
        <header className="rmm-share-header">
          <div>
            <Share2 aria-hidden="true" size={18} />
            <h2 id="rmm-share-titulo">
              Compartilhar <span>“{titulo}”</span>
            </h2>
          </div>
          <button type="button" aria-label="Fechar" onClick={onFechar}>
            <X aria-hidden="true" size={19} />
          </button>
        </header>

        <div className="rmm-share-corpo">
          <form className="rmm-share-convidar" noValidate onSubmit={convidar}>
            <label className="rmm-share-campo-email">
              <span>
                Email <b>*</b>
              </span>
              <input
                ref={emailRef}
                type="email"
                value={email}
                disabled={ocupado}
                placeholder="Adicionar pessoas por email"
                aria-invalid={emailInvalido}
                aria-describedby={emailInvalido ? 'rmm-share-email-erro' : undefined}
                onChange={(evento) => {
                  setEmail(evento.target.value);
                  if (emailInvalido) setEmailInvalido(false);
                }}
              />
              {emailInvalido && <small id="rmm-share-email-erro">Informe um email válido.</small>}
            </label>
            <SeletorPapel valor={papel} disabled={ocupado} onChange={setPapel} />
            <button className="rmm-share-primario" type="submit" disabled={ocupado}>
              Convidar
            </button>
          </form>

          {(erro || aviso) && (
            <p className={erro ? 'rmm-share-mensagem erro' : 'rmm-share-mensagem aviso'}>
              {erro ?? aviso}
            </p>
          )}

          <div className="rmm-share-secao-titulo">
            <Users aria-hidden="true" size={14} /> Quem tem acesso
          </div>
          <div className="rmm-share-lista" aria-busy={carregando}>
            {carregando && <p className="rmm-share-vazio">Carregando acessos…</p>}
            {!carregando && !falhaCarga && acessos.length === 0 && (
              <p className="rmm-share-vazio">Só você tem acesso por enquanto.</p>
            )}
            {acessos.map((item) => (
              <div className="rmm-share-pessoa" key={item.usuarioId ?? item.email}>
                <span className="rmm-share-avatar" style={{ background: item.cor ?? '#198b74' }}>
                  {inicial(item)}
                </span>
                <span className="rmm-share-identidade">
                  <strong>{item.nome || item.email}</strong>
                  {item.nome && <small>{item.email}</small>}
                </span>
                <SeletorPapel
                  valor={item.papel}
                  disabled={ocupado}
                  onChange={(novo) => void mudarPapel(item, novo)}
                />
                <button
                  className="rmm-share-remover"
                  type="button"
                  disabled={ocupado}
                  title="Remover acesso"
                  aria-label={`Remover acesso de ${item.nome || item.email}`}
                  onClick={() => void remover(item)}
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="rmm-share-geral">
            <div className="rmm-share-secao-titulo">Acesso geral</div>
            <div className="rmm-share-geral-linha">
              <span className={`rmm-share-geral-icone ${publico ? 'publico' : ''}`}>
                {publico ? (
                  <Globe aria-hidden="true" size={19} />
                ) : (
                  <Lock aria-hidden="true" size={19} />
                )}
              </span>
              <span className="rmm-share-geral-texto">
                <strong>{publico ? 'Qualquer pessoa com o link' : 'Restrito'}</strong>
                <small>{publico ? 'Vê sem conta (só leitura)' : 'Só quem você convidar'}</small>
              </span>
              <button
                className={`rmm-share-toggle ${publico ? 'ativo' : ''}`}
                type="button"
                role="switch"
                aria-checked={publico}
                aria-label="Permitir acesso pelo link"
                disabled={!link || ocupado}
                onClick={() => void mudarModo(publico ? 'restrito' : 'publico_leitura')}
              >
                <span />
              </button>
            </div>
            <button
              className="rmm-share-regenerar"
              type="button"
              disabled={!link || ocupado}
              onClick={() => void regenerar()}
            >
              <RotateCw aria-hidden="true" size={13} /> Regenerar link
            </button>
          </div>
        </div>

        <footer className="rmm-share-footer">
          <button
            className="rmm-share-copiar"
            type="button"
            disabled={!link || ocupado}
            onClick={() => void copiarLink()}
          >
            {copiado ? (
              <Check aria-hidden="true" size={16} />
            ) : (
              <Copy aria-hidden="true" size={16} />
            )}
            {copiado ? 'Link copiado' : 'Copiar link'}
          </button>
          <span className="rmm-share-url" title={link?.token}>
            <Link2 aria-hidden="true" size={13} /> /docs/compartilhado/{link?.token ?? '…'}
          </span>
          <button className="rmm-share-primario" type="button" onClick={onFechar}>
            Concluído
          </button>
        </footer>
      </dialog>
    </div>,
    document.body,
  );
}
