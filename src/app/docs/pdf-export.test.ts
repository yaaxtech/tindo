import { describe, expect, it } from 'vitest';
import { montarHtmlPdf, serializarDocumentoParaPdf } from './pdf-export';

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
});
