import type { Block } from '@blocknote/core';

type Objeto = Record<string, unknown>;

export type ConteudoPdf = {
  titulo: string;
  blocos?: Block[];
  espelhoIds?: Set<string>;
  mapaDataUrl?: string;
};

function objeto(valor: unknown): Objeto | null {
  return typeof valor === 'object' && valor !== null ? (valor as Objeto) : null;
}

export function escaparHtml(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function corSegura(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  if (/^#[0-9a-f]{3,8}$/i.test(valor)) return valor;
  if (/^(?:rgb|hsl)a?\([\d\s.,%]+\)$/i.test(valor)) return valor;
  return null;
}

function textoEstilizado(item: Objeto): string {
  let html = escaparHtml(typeof item.text === 'string' ? item.text : '');
  const estilos = objeto(item.styles);
  if (!estilos) return html;

  if (estilos.bold === true) html = `<strong>${html}</strong>`;
  if (estilos.italic === true) html = `<em>${html}</em>`;
  if (estilos.underline === true) html = `<u>${html}</u>`;
  if (estilos.strike === true) html = `<s>${html}</s>`;

  const cor = corSegura(estilos.textColor);
  const fundo = corSegura(estilos.backgroundColor);
  if (cor || fundo) {
    const css = [cor ? `color:${cor}` : '', fundo ? `background-color:${fundo}` : '']
      .filter(Boolean)
      .join(';');
    html = `<span style="${css}">${html}</span>`;
  }
  return html;
}

function inlineParaHtml(conteudo: unknown): string {
  if (typeof conteudo === 'string') return escaparHtml(conteudo);
  if (!Array.isArray(conteudo)) return '';

  return conteudo
    .map((valor) => {
      const item = objeto(valor);
      if (!item) return '';
      if (item.type === 'text') return textoEstilizado(item);
      if (item.type === 'link') {
        const href = typeof item.href === 'string' ? item.href : '';
        const seguro = /^(?:https?:|mailto:|#)/i.test(href) ? escaparHtml(href) : '#';
        return `<a href="${seguro}">${inlineParaHtml(item.content)}</a>`;
      }
      return '';
    })
    .join('');
}

function nivelTitulo(block: Block): 1 | 2 | 3 {
  const props = objeto(block.props);
  const nivel = props?.level;
  return nivel === 1 || nivel === 2 || nivel === 3 ? nivel : 2;
}

function blocoParaHtml(block: Block, numero: number | null, espelhoIds: Set<string>): string {
  const props = objeto(block.props);
  const concluida = block.type === 'checkListItem' && props?.checked === true;
  const espelho = espelhoIds.has(block.id)
    ? '<span class="pdf-espelho" title="Este item aparece em mais de um ramo">⎇</span>'
    : '';
  const conteudo = inlineParaHtml(block.content) || '<span class="pdf-vazio">Sem título</span>';

  let marcador = '';
  let corpo = conteudo;
  if (block.type === 'checkListItem') marcador = concluida ? '☑' : '☐';
  else if (block.type === 'bulletListItem') marcador = '•';
  else if (block.type === 'numberedListItem') marcador = `${numero ?? 1}.`;
  else if (block.type === 'heading') {
    const nivel = nivelTitulo(block);
    corpo = `<h${nivel}>${conteudo}</h${nivel}>`;
  } else if (block.type === 'codeBlock') {
    corpo = `<pre><code>${conteudo}</code></pre>`;
  }

  const filhos = renderizarBlocosParaPdf(block.children ?? [], espelhoIds);
  return `<section class="pdf-item${concluida ? ' pdf-concluida' : ''}">
    <div class="pdf-linha">
      <span class="pdf-marcador">${marcador}</span>
      ${espelho}
      <div class="pdf-conteudo">${corpo}</div>
    </div>
    ${filhos ? `<div class="pdf-filhos">${filhos}</div>` : ''}
  </section>`;
}

export function renderizarBlocosParaPdf(
  blocos: Block[],
  espelhoIds: Set<string> = new Set(),
): string {
  let numero = 0;
  return blocos
    .map((block) => {
      const atual = block.type === 'numberedListItem' ? ++numero : null;
      return blocoParaHtml(block, atual, espelhoIds);
    })
    .join('');
}

export function montarHtmlPdf({
  titulo,
  blocos,
  espelhoIds = new Set(),
  mapaDataUrl,
}: ConteudoPdf): string {
  const tituloSeguro = escaparHtml(titulo);
  const temDocumento = blocos !== undefined;
  const temMapa = typeof mapaDataUrl === 'string' && mapaDataUrl.startsWith('data:image/png');
  const combinado = temDocumento && temMapa;
  const documento = temDocumento
    ? `<section class="pdf-pagina pdf-documento"><h1>${tituloSeguro}</h1>${renderizarBlocosParaPdf(blocos, espelhoIds)}</section>`
    : '';
  const mapa = temMapa
    ? `<section class="pdf-pagina pdf-mapa"><h1>${tituloSeguro} — mapa mental</h1><img src="${mapaDataUrl}" alt="${tituloSeguro} — mapa mental" /></section>`
    : '';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${tituloSeguro}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1b222c; line-height: 1.5; }
  .pdf-pagina { background: #fff; }
  .pdf-documento { page: documento; max-width: 760px; margin: 0 auto; }
  .pdf-documento > h1 { margin: 0 0 22px; font-size: 26px; letter-spacing: -0.02em; }
  .pdf-item { break-inside: avoid; }
  .pdf-linha { display: grid; grid-template-columns: 18px 16px minmax(0, 1fr); align-items: baseline; min-height: 25px; }
  .pdf-marcador { color: #4a5563; text-align: center; font-variant-numeric: tabular-nums; }
  .pdf-espelho { color: #198b74; font-weight: 700; text-align: center; }
  .pdf-conteudo { min-width: 0; overflow-wrap: anywhere; }
  .pdf-conteudo h1, .pdf-conteudo h2, .pdf-conteudo h3 { margin: 6px 0 4px; letter-spacing: -0.01em; }
  .pdf-conteudo h1 { font-size: 21px; } .pdf-conteudo h2 { font-size: 18px; } .pdf-conteudo h3 { font-size: 16px; }
  .pdf-conteudo pre { margin: 6px 0; padding: 10px 12px; border: 1px solid #d4dae1; border-radius: 6px; background: #f4f6f8; white-space: pre-wrap; }
  .pdf-filhos { margin-left: 24px; padding-left: 10px; border-left: 1px solid #dfe4e9; }
  .pdf-concluida > .pdf-linha > .pdf-conteudo { color: #7a8796; text-decoration: line-through; }
  .pdf-vazio { color: #9aa3ad; font-style: italic; }
  a { color: #198b74; }
  .pdf-mapa { page: mapa; display: flex; min-height: 170mm; flex-direction: column; align-items: center; justify-content: center; }
  .pdf-mapa h1 { align-self: stretch; margin: 0 0 10px; font-size: 20px; }
  .pdf-mapa img { display: block; width: 100%; max-height: 165mm; object-fit: contain; }
  ${combinado ? '.pdf-mapa { break-before: page; }' : ''}
  @page documento { size: A4 portrait; margin: 18mm 16mm; }
  @page mapa { size: A4 landscape; margin: 10mm; }
  @page { size: ${temMapa && !temDocumento ? 'A4 landscape' : 'A4 portrait'}; margin: ${temMapa && !temDocumento ? '10mm' : '18mm 16mm'}; }
</style></head><body>${documento}${mapa}</body></html>`;
}
