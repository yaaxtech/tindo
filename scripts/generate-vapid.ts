#!/usr/bin/env bun
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('Adicione em .env.local:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_SUBJECT=mailto:falecomseucamarao@gmail.com`);

// Salva em .env.local.vapid-tmp (gitignored) para uso nesta sessão
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const tmp = join(import.meta.dir, '..', '.env.local.vapid-tmp');
writeFileSync(
  tmp,
  [
    `VAPID_PUBLIC_KEY=${keys.publicKey}`,
    `VAPID_PRIVATE_KEY=${keys.privateKey}`,
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`,
    `VAPID_SUBJECT=mailto:falecomseucamarao@gmail.com`,
    '',
  ].join('\n'),
  'utf8',
);

console.log(`\nChaves salvas em .env.local.vapid-tmp — mova essas linhas para .env.local real.`);
