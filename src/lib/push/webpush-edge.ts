/**
 * Web Push VAPID via Web Crypto API — 100% edge-compatible.
 * Substitui a lib `web-push` (Node.js only) para funcionar em CF Pages / Edge Runtime.
 *
 * Referência: RFC 8292 (VAPID) + RFC 8030 (Web Push Protocol).
 * Implementação baseada em: https://github.com/nicolo-ribaudo/web-push-web-crypto
 */

/** Garante que um Uint8Array usa ArrayBuffer (não SharedArrayBuffer) — necessário para Web Crypto. */
function toArrayBuffer(arr: Uint8Array): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(arr.byteLength);
  new Uint8Array(buf).set(arr);
  return new Uint8Array(buf);
}

function base64UrlDecode(str: string): Uint8Array<ArrayBuffer> {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (padded.length % 4)) % 4);
  const b64 = padded + padding;
  const raw = atob(b64);
  const arr = new ArrayBuffer(raw.length);
  const view = new Uint8Array(arr);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view as Uint8Array<ArrayBuffer>;
}

function base64UrlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function uint8ToBase64Url(arr: Uint8Array): string {
  return base64UrlEncode(arr.buffer as ArrayBuffer);
}

async function importVapidPrivateKey(base64PrivateKey: string): Promise<CryptoKey> {
  // VAPID private key é um EC P-256 raw private key (32 bytes) em base64url
  const raw = base64UrlDecode(base64PrivateKey);
  // Importar como JWK para maior compatibilidade
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    // O private key raw não inclui a chave pública — geramos uma chave efêmera pra assinar
    d: uint8ToBase64Url(raw),
    key_ops: ['sign'],
    ext: true,
  };
  // Como não temos x/y (pública), usamos PKCS8 importado via DER
  // Fallback: usar sign direto com EC key via raw bytes
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
}

async function generateVapidToken(
  audience: string,
  subject: string,
  privateKey: CryptoKey,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).buffer as ArrayBuffer,
  );
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: subject }))
      .buffer as ArrayBuffer,
  );

  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string,
): Promise<{ ciphertext: ArrayBuffer; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const recipientPublicKey = base64UrlDecode(p256dhBase64);
  const authSecret = base64UrlDecode(authBase64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Gerar ephemeral key pair para ECDH
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );

  const serverPublicKeyBuffer = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
  const serverPublicKey = new Uint8Array(serverPublicKeyBuffer);

  // Importar chave pública do destinatário
  const recipientKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(recipientPublicKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // ECDH shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientKey },
    serverKeyPair.privateKey,
    256,
  );

  // HKDF para derivar IKM
  const encoder = new TextEncoder();
  const zeroArr = new ArrayBuffer(1);

  // Auth info
  const authInfo = encoder.encode('Content-Encoding: auth\0');
  const ikm = await hkdf(
    new Uint8Array(sharedSecret) as Uint8Array<ArrayBuffer>,
    toArrayBuffer(authSecret),
    concat(authInfo, new Uint8Array(zeroArr)),
    32,
  );

  // Context
  const context = concat(
    encoder.encode('P-256\0'),
    new Uint8Array([0, recipientPublicKey.length]),
    recipientPublicKey,
    new Uint8Array([0, serverPublicKey.length]),
    serverPublicKey,
  );

  // CEK and nonce
  const cekInfo = concat(encoder.encode('Content-Encoding: aesgcm\0'), context);
  const nonceInfo = concat(encoder.encode('Content-Encoding: nonce\0'), context);

  const saltNorm = toArrayBuffer(salt);
  const cek = await hkdf(ikm, saltNorm, cekInfo, 16);
  const nonce = await hkdf(ikm, saltNorm, nonceInfo, 12);

  // Encrypt with AES-GCM
  const cekKey = await crypto.subtle.importKey('raw', toArrayBuffer(cek), 'AES-GCM', false, [
    'encrypt',
  ]);

  // Pad payload to hide length (2 bytes padding length + payload + padding)
  const plaintext = encoder.encode(payload);
  const paddedBuf = new ArrayBuffer(2 + plaintext.length);
  const padded = new Uint8Array(paddedBuf);
  padded.set(plaintext, 2); // 2-byte padding length = 0

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(nonce) },
    cekKey,
    paddedBuf,
  );

  return { ciphertext, salt, serverPublicKey };
}

async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const ikmNorm = toArrayBuffer(ikm);
  const saltNorm = toArrayBuffer(salt);
  const infoNorm = toArrayBuffer(info);
  const keyMaterial = await crypto.subtle.importKey('raw', ikmNorm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: saltNorm, info: infoNorm },
    keyMaterial,
    length * 8,
  );
  return new Uint8Array(bits) as Uint8Array<ArrayBuffer>;
}

function concat(...arrays: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = arrays.reduce((acc, a) => acc + a.length, 0);
  const buf = new ArrayBuffer(total);
  const result = new Uint8Array(buf);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result as Uint8Array<ArrayBuffer>;
}

export interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: string,
  vapid: VapidConfig,
): Promise<Response> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const privateKey = await importVapidPrivateKey(vapid.privateKey);
  const token = await generateVapidToken(audience, vapid.subject, privateKey);

  const { ciphertext, salt, serverPublicKey } = await encryptPayload(
    payload,
    subscription.keys.p256dh,
    subscription.keys.auth,
  );

  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      Encryption: `salt=${base64UrlEncode(salt.buffer as ArrayBuffer)}`,
      'Crypto-Key': `dh=${uint8ToBase64Url(serverPublicKey)};p256ecdsa=${vapid.publicKey}`,
      Authorization: `WebPush ${token}`,
      TTL: '86400',
    },
    body: ciphertext,
  });
}
