/*
 * `/tindo` — atalho público que leva à fila de cards.
 *
 * Existe para que o rótulo mostrado no card da vitrine (`/yaax`) seja
 * exatamente o endereço que o link abre: sem rótulo mentiroso e sem 404.
 * Quem chega sem sessão vai para `/cards`, e o middleware manda para
 * `/login?next=/cards` — comportamento correto, o destino continua protegido.
 */

import { redirect } from 'next/navigation';

export default function TinDoPage() {
  redirect('/cards');
}
