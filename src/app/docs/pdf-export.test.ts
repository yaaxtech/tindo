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
    // só UM corte entre documento e mapa: break-after na seção anterior.
    // break-before junto criava uma folha vazia no meio do PDF.
    expect(html).toContain('break-after: page');
    expect(html).not.toContain('break-before: page');
  });

  it('segue o tema do sistema: claro = página branca, escuro = página escura', () => {
    const claro = montarHtmlPdf({
      titulo: 'Doc',
      documentoHtml: '<main class="rmm-editor">x</main>',
      tema: 'light',
    });
    expect(claro).toContain('background: #ffffff');
    expect(claro).toContain('color: #1b222c');

    const escuro = montarHtmlPdf({
      titulo: 'Doc',
      documentoHtml: '<main class="rmm-editor">x</main>',
      tema: 'dark',
    });
    expect(escuro).toContain('background: #121820');
    expect(escuro).toContain('color: #e8edf2');
    // o corpo (áreas vazias da folha) também acompanha o tema
    expect(escuro).toContain('background: #121820; }');
  });

  it('a imagem do mapa cabe em UMA página (sem estourar nem sobrar folha vazia)', () => {
    const html = montarHtmlPdf({
      titulo: 'Doc',
      mapaDataUrl: 'data:image/png;base64,abc',
    });
    // caixa de 1 folha medida em mm + recorte + imagem que encolhe.
    // vh é proibido aqui: na impressão vale a altura da página INICIAL
    // (retrato), o que estourava a folha paisagem do mapa numa 2ª página vazia.
    expect(html).toContain('width: 297mm');
    expect(html).toContain('height: 210mm');
    expect(html).not.toContain('height: 100vh');
    expect(html).toContain('overflow: hidden');
    expect(html).toContain('max-height: 100%');
    expect(html).not.toContain('.pdf-mapa img { display: block; width: 100%; height: 100%');
  });

  it('mapa em retrato usa a folha em pé (210x297mm)', () => {
    const html = montarHtmlPdf({
      titulo: 'Doc',
      mapaDataUrl: 'data:image/png;base64,abc',
      orientacaoMapa: 'portrait',
    });
    expect(html).toContain('width: 210mm');
    expect(html).toContain('height: 297mm');
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
