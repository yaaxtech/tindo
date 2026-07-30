// RoadMapMind — rota /docs (Fase 1 MVP).
// Fatia 0: placeholder. O editor (BlockNote) e o mindmap (React Flow) entram
// nas fatias seguintes. Ver spec:
// docs/superpowers/plans/2026-07-30-roadmapmind-fase-1-mvp.md

export const metadata = { title: 'RoadMapMind' };

export default function DocsPage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        background: '#0A0E13',
        color: '#E8EDF2',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>RoadMapMind</h1>
      <p style={{ color: '#7A8796', margin: 0 }}>
        Em construção — editor e mapa chegam nas próximas etapas.
      </p>
    </main>
  );
}
