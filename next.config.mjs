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
};

export default withPWA(nextConfig);
