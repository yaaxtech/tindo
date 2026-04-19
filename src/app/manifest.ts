import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TinDo — foco por swipe',
    short_name: 'TinDo',
    description: 'Produtividade uma tarefa por vez.',
    start_url: '/cards',
    display: 'standalone',
    background_color: '#0A0E13',
    theme_color: '#0A0E13',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/apple-touch-icon.svg', sizes: '180x180', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Cards', short_name: 'Cards', url: '/cards' },
      { name: 'Sugestões IA', short_name: 'IA', url: '/sugestoes-ia' },
      { name: 'Tarefas', short_name: 'Tarefas', url: '/tarefas' },
      { name: 'Gamificação', short_name: 'Streak', url: '/gamificacao' },
    ],
    categories: ['productivity', 'utilities'],
    lang: 'pt-BR',
  };
}
