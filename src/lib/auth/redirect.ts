const ORIGEM_INTERNA = 'https://tindo.invalid';

function contemCaractereDeControle(valor: string): boolean {
  for (const caractere of valor) {
    const codigo = caractere.charCodeAt(0);
    if (codigo <= 31 || codigo === 127) return true;
  }
  return false;
}

function caminhoDecodificadoEhSeguro(valor: string): boolean {
  let caminho = valor.split(/[?#]/, 1)[0] ?? '';

  try {
    // Duas passadas também barram payloads duplamente codificados.
    caminho = decodeURIComponent(caminho);
    caminho = decodeURIComponent(caminho);
  } catch {
    return false;
  }

  return (
    !caminho.startsWith('//') && !caminho.includes('\\') && !contemCaractereDeControle(caminho)
  );
}

/** Aceita somente destinos internos para evitar open redirect após login. */
export function destinoInternoSeguro(valor: string | null | undefined, fallback = '/docs'): string {
  if (!valor || !valor.startsWith('/') || !caminhoDecodificadoEhSeguro(valor)) return fallback;

  try {
    const url = new URL(valor, ORIGEM_INTERNA);
    if (url.origin !== ORIGEM_INTERNA) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
