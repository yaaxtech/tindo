/*
 * `/roadmapmind` — atalho público que leva ao editor de documentos e mapas.
 *
 * Existe para que o rótulo mostrado no card da vitrine (`/yaax`) seja
 * exatamente o endereço que o link abre: sem rótulo mentiroso e sem 404.
 * Quem chega sem sessão vai para `/docs`, e o middleware manda para
 * `/login?next=/docs` — comportamento correto, o destino continua protegido.
 */

import { redirect } from 'next/navigation';

export default function RoadMapMindPage() {
  redirect('/docs');
}
