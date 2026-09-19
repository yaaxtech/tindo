import createPWA from '@ducanh2912/next-pwa';

const withPWA = createPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // BlockNote (RoadMapMind editor) does not yet support StrictMode on React 19
  // (TypeCellOS/BlockNote#1347) — risk accepted in ticket 02 of the wayfinder map.
  reactStrictMode: false,
  experimental: {
    reactCompiler: false,
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  /*
   * Atalhos anunciados na vitrine da YaaX (`/yaax`), para que o rótulo do card
   * seja exatamente o endereço que o link abre.
   *
   * Ficam aqui, e não como páginas com `redirect()`: sem dados dinâmicos, o Next
   * prerenderiza a rota e resolve o `redirect()` com `<meta http-equiv="refresh"
   * content="1;url=...">` — um segundo de tela branca a cada clique. Aqui vira
   * 308 na camada de roteamento, instantâneo e sem HTML intermediário.
   *
   * Os destinos seguem protegidos: o middleware roda depois e manda quem não
   * tem sessão para `/login?next=…`.
   */
  async redirects() {
    return [
      { source: '/tindo', destination: '/cards', permanent: false },
      { source: '/roadmapmind', destination: '/docs', permanent: false },
    ];
  },
};

export default withPWA(nextConfig);
