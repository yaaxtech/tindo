'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef } from 'react';

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileProps {
  onToken: (token: string | null) => void;
}

export const turnstileConfigurado = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export function Turnstile({ onToken }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);

  const renderizar = useCallback(() => {
    if (!turnstileConfigurado || !window.turnstile || !containerRef.current || widgetRef.current) {
      return;
    }
    widgetRef.current = window.turnstile.render(containerRef.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      theme: 'dark',
      callback: (token: string) => onToken(token),
      'expired-callback': () => onToken(null),
      'error-callback': () => onToken(null),
    });
  }, [onToken]);

  useEffect(() => {
    onToken(null);
    renderizar();
    return () => {
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [onToken, renderizar]);

  if (!turnstileConfigurado) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderizar}
      />
      <div ref={containerRef} className="flex min-h-[65px] justify-center" />
    </>
  );
}
