'use client';

import { useCallback, useEffect, useState } from 'react';

export type PushStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'error' | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('idle');
  const [subscriptionEndpoint, setSubscriptionEndpoint] = useState<string | null>(null);

  // Verifica suporte e permissao atual ao montar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      return;
    }
    const perm = Notification.permission;
    if (perm === 'denied') {
      setStatus('denied');
      return;
    }
    // Verifica se já tem subscription ativa
    navigator.serviceWorker.getRegistration('/sw-push.js').then((reg) => {
      if (!reg) return;
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) {
          setStatus('granted');
          setSubscriptionEndpoint(sub.endpoint);
        }
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      return;
    }

    setStatus('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY não definida.');
      }

      // Passa a chave como string — o browser converte internamente (suporte universal)
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      });

      const subJson = sub.toJSON() as {
        endpoint: string;
        keys?: { p256dh: string; auth: string };
      };

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: subJson.endpoint,
            keys: { p256dh: subJson.keys?.p256dh ?? '', auth: subJson.keys?.auth ?? '' },
          },
          userAgent: navigator.userAgent,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Erro ao salvar subscription.');
      }

      setStatus('granted');
      setSubscriptionEndpoint(sub.endpoint);
    } catch (err) {
      console.error('[usePushSubscription] subscribe erro:', err);
      setStatus('error');
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setStatus('loading');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
      }
      setStatus('idle');
      setSubscriptionEndpoint(null);
    } catch (err) {
      console.error('[usePushSubscription] unsubscribe erro:', err);
      setStatus('error');
    }
  }, []);

  return { status, subscriptionEndpoint, subscribe, unsubscribe };
}
