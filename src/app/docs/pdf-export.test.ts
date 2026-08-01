import { describe, expect, it } from 'vitest';
import { montarHtmlPdf, nomeArquivoPdf, serializarDocumentoParaPdf } from './pdf-export';

describe('PDF do RoadMapMind', () => {
  it('clona o documento real, preserva checks e desativa a edição', () => {
    const elemento = document.createElement('main');
    elemento.className = 'rmm-editor';
    elemento.innerHTML =
      '<div contenteditable="true"><input type="checkbox" /><span>Minha tarefa</span></div>';
    const checkbox = elemento.querySelector('input');
    if (checkbox) checkbox.checked = true;

    const html = serializarDocumentoParaPdf(elemento);

    expect(html).toContain('class="rmm-editor"');
    expect(html).toContain('checked=""');
    expect(html).toContain('contenteditable="false"');
    expect(html).toContain('Minha tarefa');
  });

  it('gera documento e mapa sem redesenhar o conteúdo e escapa o título', () => {
    const html = montarHtmlPdf({
      titulo: '<Meu documento>',
      documentoHtml: '<main class="rmm-editor">Conteúdo real</main>',
      classesRaiz: 'rmm-root rmm-tema-light',
      mapaDataUrl: 'data:image/png;base64,abc',
      fundoMapa: '#ffffff',
    });

    expect(html).toContain('&lt;Meu documento&gt;');
    expect(html).toContain('Conteúdo real');
    expect(html).toContain('rmm-tema-light pdf-pagina pdf-documento');
    expect(html).toContain('background: #ffffff');
    expect(html).toContain('pdf-mapa');
    expect(html).toContain('--pdf-fundo-mapa:#ffffff');
    expect(html).toContain('break-before: page');
  });

  it('usa data e nome limpo no arquivo e respeita a orientação do mapa', () => {
    expect(nomeArquivoPdf('Meu Documento!', new Date(2026, 7, 1))).toBe('20260801_MeuDocumento');

    const html = montarHtmlPdf({
      titulo: 'Meu Documento',
      nomeArquivo: '20260801_MeuDocumento',
      mapaDataUrl: 'data:image/png;base64,abc',
      orientacaoMapa: 'portrait',
    });

    expect(html).toContain('<title>20260801_MeuDocumento</title>');
    expect(html).toContain('@page mapa { size: A4 portrait; margin: 0; }');
    expect(html).toContain('@page { size: A4 portrait; margin: 0; }');
  });
});
