'use client';

// RoadMapMind — rota /docs (Fase 1 MVP). BlockNote é client-only → dynamic ssr:false.
// Ver spec: docs/superpowers/plans/2026-07-30-roadmapmind-fase-1-mvp.md

import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('./Editor'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: '100dvh', background: '#0A0E13', color: '#7A8796', padding: 32 }}>
      Carregando RoadMapMind…
    </div>
  ),
});

export default function DocsPage() {
  return <Editor />;
}
