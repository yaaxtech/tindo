export const ORIGEM_OFICIAL = 'https://tindoapp.pages.dev';

const HOST_TECNICO_ANTIGO = 'tindo.falecomyaax.workers.dev';

/** Mantém caminhos e parâmetros ao levar acessos do Worker antigo para o endereço oficial. */
export function urlNoEnderecoOficial(url: URL): URL | null {
  if (url.hostname !== HOST_TECNICO_ANTIGO) return null;

  const destino = new URL(ORIGEM_OFICIAL);
  destino.pathname = url.pathname;
  destino.search = url.search;
  destino.hash = url.hash;
  return destino;
}
