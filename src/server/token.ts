import 'server-only';
import type { GameId, Lang } from '@/lib/types';

/**
 * Tokens de partidas de práctica: JSON cifrado con AES-GCM (Web Crypto).
 * El cifrado autenticado impide tanto leer la solución como alterarla.
 */
export type PracticePayload = {
  v: 1;
  game: GameId;
  lang: Lang;
  /** Índice en la lista de soluciones (palabras) o fecha ISO (juego de fecha). */
  ref: number | string;
  /** Fecha del servidor al crear la partida: límite superior del juego de fecha. */
  createdOn: string;
  dateHints: boolean;
};

const keyCache = new Map<string, Promise<CryptoKey>>();

function getKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(secret))
      .then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
    keyCache.set(secret, key);
  }
  return key;
}

const toBase64Url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (value: string) => new Uint8Array(Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));

export async function sealToken(payload: PracticePayload, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getKey(secret), data));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv);
  out.set(cipher, iv.length);
  return toBase64Url(out);
}

export async function openToken(token: string, secret: string): Promise<PracticePayload | null> {
  try {
    if (typeof token !== 'string' || token.length < 24 || token.length > 1024) return null;
    const bytes = fromBase64Url(token);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.subarray(0, 12) },
      await getKey(secret),
      bytes.subarray(12),
    );
    const payload = JSON.parse(new TextDecoder().decode(plain)) as PracticePayload;
    return payload?.v === 1 ? payload : null;
  } catch {
    return null;
  }
}
