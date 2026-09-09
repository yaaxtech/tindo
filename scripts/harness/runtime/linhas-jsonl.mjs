import { createReadStream } from 'node:fs';

// JSONL delimita registros por LF; U+2028/U+2029 são conteúdo JSON válido.
export async function* linhasJsonl(caminho) {
  const stream = createReadStream(caminho, { encoding: 'utf8' });
  let restante = '';
  for await (const trecho of stream) {
    restante += trecho;
    let inicio = 0;
    let fim = restante.indexOf('\n');
    while (fim !== -1) {
      yield restante.slice(inicio, fim).replace(/\r$/, '');
      inicio = fim + 1;
      fim = restante.indexOf('\n', inicio);
    }
    restante = restante.slice(inicio);
  }
  if (restante) yield restante.replace(/\r$/, '');
}
