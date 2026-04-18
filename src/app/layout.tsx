import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TinDo — foco por swipe',
  description:
    'Produtividade uma-tarefa-por-vez. IA prioriza, neurociência recompensa, gamificação sustenta.',
  applicationName: 'TinDo',
  authors: [{ name: 'YaaX' }],
  keywords: ['todo', 'produtividade', 'tinder', 'tarefa', 'foco'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TinDo',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0E13',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-dvh bg-bg-deep text-text-primary no-tap">{children}</body>
    </html>
  );
}
