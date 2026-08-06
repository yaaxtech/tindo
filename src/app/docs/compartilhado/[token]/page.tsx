'use client';

// RoadMapMind — rota PÚBLICA /docs/compartilhado/<token> (Fatia 5): visão
// só-leitura, sem login. BlockNote é client-only → dynamic ssr:false.

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const LeitorPublico = dynamic(() => import('./LeitorPublico'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: '100dvh', background: '#0A0E13', color: '#7A8796', padding: 32 }}>
      Carregando documento…
    </div>
  ),
});

export default function DocPublicoPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  return <LeitorPublico token={token} />;
}
