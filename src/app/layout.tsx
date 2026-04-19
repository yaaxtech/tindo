import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RecalibracaoBanner } from '@/components/RecalibracaoBanner';
import { Toaster } from '@/components/Toaster';

const TITLE = 'TinDo — foco por swipe';
const DESCRIPTION =
  'Produtividade uma-tarefa-por-vez. IA prioriza, neurociência recompensa, gamificação sustenta.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'TinDo',
  authors: [{ name: 'YaaX' }],
  keywords: ['todo', 'produtividade', 'tinder', 'tarefa', 'foco'],
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.svg',
    shortcut: '/favicon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TinDo',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
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
      <body className="min-h-dvh bg-bg-deep text-text-primary no-tap">
        {children}
        <RecalibracaoBanner />
        <Toaster />
      </body>
    </html>
  );
}
