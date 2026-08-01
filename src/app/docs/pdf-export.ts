export type ConteudoPdf = {
  titulo: string;
  nomeArquivo?: string;
  documentoHtml?: string;
  estilosDocumento?: string;
  classesRaiz?: string;
  mapaDataUrl?: string;
  fundoMapa?: string;
  orientacaoMapa?: 'portrait' | 'landscape';
};

export function escaparHtml(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function nomeArquivoPdf(titulo: string, data = new Date()): string {
  const dataFormatada = [data.getFullYear(), data.getMonth() + 1, data.getDate()]
    .map((parte) => String(parte).padStart(2, '0'))
    .join('');
  const nomeLimpo = titulo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .slice(0, 80);

  return `${dataFormatada}_${nomeLimpo || 'RoadMapMind'}`;
}

export function serializarDocumentoParaPdf(elemento: HTMLElement): string {
  const clone = elemento.cloneNode(true) as HTMLElement;
  const originais = elemento.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const copias = clone.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

  originais.forEach((original, indice) => {
    const copia = copias[indice];
    if (!copia) return;
    copia.checked = original.checked;
    if (original.checked) copia.setAttribute('checked', '');
    else copia.removeAttribute('checked');
  });

  for (const item of clone.querySelectorAll('[contenteditable]')) {
    item.setAttribute('contenteditable', 'false');
  }
  for (const item of clone.querySelectorAll('.bn-side-menu, .bn-formatting-toolbar')) {
    item.remove();
  }

  return clone.outerHTML;
}

export function capturarEstilosDaPagina(): string {
  const estilos = [...document.head.querySelectorAll('style, link[rel="stylesheet"]')];
  const estilosLocais = [...document.querySelectorAll('.rmm-root > style')];

  return [...estilos, ...estilosLocais]
    .map((item) => {
      if (item instanceof HTMLLinkElement) {
        return `<link rel="stylesheet" href="${escaparHtml(item.href)}" />`;
      }
      return item.outerHTML;
    })
    .join('');
}

export function montarHtmlPdf({
  titulo,
  nomeArquivo = nomeArquivoPdf(titulo),
  documentoHtml,
  estilosDocumento = '',
  classesRaiz = 'rmm-root rmm-tema-light',
  mapaDataUrl,
  fundoMapa = '#ffffff',
  orientacaoMapa = 'landscape',
}: ConteudoPdf): string {
  const tituloSeguro = escaparHtml(titulo);
  const nomeArquivoSeguro = escaparHtml(nomeArquivo);
  const temDocumento = typeof documentoHtml === 'string';
  const temMapa = typeof mapaDataUrl === 'string' && mapaDataUrl.startsWith('data:image/png');
  const combinado = temDocumento && temMapa;
  const documento = temDocumento
    ? `<section class="${escaparHtml(classesRaiz)} pdf-pagina pdf-documento">${documentoHtml}</section>`
    : '';
  const mapa = temMapa
    ? `<section class="pdf-pagina pdf-mapa" style="--pdf-fundo-mapa:${escaparHtml(fundoMapa)}"><img src="${mapaDataUrl}" alt="${tituloSeguro} - mapa mental" /></section>`
    : '';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${nomeArquivoSeguro}</title>
${estilosDocumento}
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  .pdf-pagina { break-after: page; }
  .pdf-pagina:last-child { break-after: auto; }
  .pdf-documento.rmm-root {
    page: documento;
    display: block;
    width: 100%;
    height: auto;
    min-height: 100vh;
    overflow: visible;
    background: #ffffff;
    color: #1b222c;
  }
  .pdf-documento .rmm-editor {
    margin: 0 auto;
    padding-bottom: 28px;
  }
  .pdf-documento .bn-editor { caret-color: transparent; }
  .pdf-documento .bn-side-menu,
  .pdf-documento .bn-formatting-toolbar { display: none !important; }
  .pdf-mapa {
    page: mapa;
    width: 100%;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: var(--pdf-fundo-mapa);
  }
  .pdf-mapa img { display: block; width: 100%; height: 100%; object-fit: contain; }
  ${combinado ? '.pdf-mapa { break-before: page; }' : ''}
  @page documento { size: A4 portrait; margin: 0; }
  @page mapa { size: A4 ${orientacaoMapa}; margin: 0; }
  @page { size: ${temMapa && !temDocumento ? `A4 ${orientacaoMapa}` : 'A4 portrait'}; margin: 0; }
</style></head><body>${documento}${mapa}</body></html>`;
}
