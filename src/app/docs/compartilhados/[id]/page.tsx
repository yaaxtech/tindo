'use client';

// RoadMapMind — rota /docs/compartilhados/<id> (Fatia 1b): visão só-leitura de
// um documento compartilhado comigo. BlockNote é client-only → dynamic ssr:false.

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const Visualizador = dynamic(() => import('./Visualizador'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: '100dvh', background: '#0A0E13', color: '#7A8796', padding: 32 }}>
      Carregando documento…
    </div>
  ),
});

export default function DocCompartilhadoPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  return <Visualizador documentoId={id} />;
}
