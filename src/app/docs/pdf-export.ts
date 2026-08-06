export type ConteudoPdf = {
  titulo: string;
  nomeArquivo?: string;
  documentoHtml?: string;
  estilosDocumento?: string;
  classesRaiz?: string;
  mapaDataUrl?: string;
  fundoMapa?: string;
  orientacaoMapa?: 'portrait' | 'landscape';
  // tema do sistema no momento da exportação: escuro = páginas escuras
  tema?: 'dark' | 'light';
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
  tema = 'light',
}: ConteudoPdf): string {
  const tituloSeguro = escaparHtml(titulo);
  const nomeArquivoSeguro = escaparHtml(nomeArquivo);
  // cor de fundo/texto das páginas segue o tema do sistema
  const escuro = tema === 'dark';
  const fundoPagina = escuro ? '#121820' : '#ffffff';
  const corTexto = escuro ? '#e8edf2' : '#1b222c';
  // A4 em milímetros — medida da folha, imune ao vh (que na impressão vale
  // sempre a página inicial, mesmo quando a folha atual tem outra orientação).
  const larguraMapa = orientacaoMapa === 'landscape' ? '297mm' : '210mm';
  const alturaMapa = orientacaoMapa === 'landscape' ? '210mm' : '297mm';
  const alturaDocumento = '297mm';
  const temDocumento = typeof documentoHtml === 'string';
  const temMapa = typeof mapaDataUrl === 'string' && mapaDataUrl.startsWith('data:image/png');
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
  html, body { margin: 0; padding: 0; background: ${fundoPagina}; }
  .pdf-pagina { break-after: page; }
  .pdf-pagina:last-child { break-after: auto; }
  .pdf-documento.rmm-root {
    page: documento;
    display: block;
    width: 100%;
    height: auto;
    min-height: ${alturaDocumento};
    overflow: visible;
    background: ${fundoPagina};
    color: ${corTexto};
  }
  .pdf-documento .rmm-editor {
    margin: 0 auto;
    padding-bottom: 28px;
  }
  .pdf-documento .bn-editor { caret-color: transparent; }
  .pdf-documento .bn-side-menu,
  .pdf-documento .bn-formatting-toolbar { display: none !important; }
  /* A caixa do mapa mede a folha em MILÍMETROS, não em vh. Na impressão, 100vh
     vale a altura da página INICIAL (A4 retrato, 297mm); como a folha do mapa é
     paisagem (210mm de altura), a caixa ficava ~87mm mais alta que a folha e
     transbordava para uma 2ª página VAZIA. */
  .pdf-mapa {
    page: mapa;
    width: ${larguraMapa};
    height: ${alturaMapa};
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: var(--pdf-fundo-mapa);
  }
  /* a imagem ENCOLHE pra caber em UMA página (limitada pela largura E pela
     altura da própria caixa de 1 página), preservando a proporção.
     max-height:100% na imagem é relativo à CAIXA (confiável), não ao viewport;
     overflow:hidden na caixa corta sobra de arredondamento. */
  .pdf-mapa img {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
  }
  /* NÃO acrescentar break-before no mapa: a seção anterior já tem
     break-after: page. Os dois juntos geram uma folha VAZIA no meio
     (era a "página a mais" do PDF de documento+mapa). */
  @page documento { size: A4 portrait; margin: 0; }
  @page mapa { size: A4 ${orientacaoMapa}; margin: 0; }
  @page { size: ${temMapa && !temDocumento ? `A4 ${orientacaoMapa}` : 'A4 portrait'}; margin: 0; }
</style></head><body>${documento}${mapa}</body></html>`;
}
