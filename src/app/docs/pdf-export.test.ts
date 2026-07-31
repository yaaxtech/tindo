import type { Block } from '@blocknote/core';
import { describe, expect, it } from 'vitest';
import { montarHtmlPdf, renderizarBlocosParaPdf } from './pdf-export';

const texto = (id: string, valor: string, children: Block[] = []): Block =>
  ({
    id,
    type: 'bulletListItem',
    props: {},
    content: [{ type: 'text', text: valor, styles: {} }],
    children,
  }) as unknown as Block;

const tarefa = (id: string, valor: string, checked: boolean): Block =>
  ({
    id,
    type: 'checkListItem',
    props: { checked },
    content: [{ type: 'text', text: valor, styles: {} }],
    children: [],
  }) as unknown as Block;

describe('PDF do RoadMapMind', () => {
  it('mantém marcador, checkbox e texto na mesma linha e preserva a hierarquia', () => {
    const html = renderizarBlocosParaPdf([
      texto('campanha', 'Campanha de Julho', [
        tarefa('post', 'Post no Instagram', false),
        tarefa('legenda', 'Escrever legenda', true),
      ]),
    ]);

    expect(html).toContain('<span class="pdf-marcador">•</span>');
    expect(html).toContain('<span class="pdf-marcador">☐</span>');
    expect(html).toContain('<span class="pdf-marcador">☑</span>');
    expect(html).toContain('<div class="pdf-filhos">');
    expect(html).toContain('Post no Instagram');
  });

  it('gera documento e mapa no mesmo arquivo e escapa o título', () => {
    const html = montarHtmlPdf({
      titulo: '<Meu documento>',
      blocos: [texto('a', 'Linha')],
      mapaDataUrl: 'data:image/png;base64,abc',
    });

    expect(html).toContain('&lt;Meu documento&gt;');
    expect(html).toContain('pdf-documento');
    expect(html).toContain('pdf-mapa');
    expect(html).toContain('break-before: page');
  });
});
