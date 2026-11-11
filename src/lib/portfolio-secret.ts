import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Enkripsi API key portfolio di database: AES-256-GCM, kunci diturunkan (HKDF-SHA256)
 * dari secret yang sudah ada (SESSION_SECRET) dengan label khusus, jadi bukan kunci yang sama
 * dengan penanda tangan cookie. Mengganti SESSION_SECRET membuat key tersimpan tidak terbaca
 * dan harus diisi ulang.
 */
const VERSION = 'v1';
const AAD = Buffer.from('portfolio-mcp-api-key');

const b64 = (buffer: Buffer) => buffer.toString('base64url');

function deriveKey(secret: string): Buffer {
  if (!secret) throw new Error('SECRET_MISSING');
  return Buffer.from(hkdfSync('sha256', secret, 'pusaka-feedback-salt', 'portfolio-mcp-api-key:v1', 32));
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(ciphertext)].join('.');
}

/** Melempar Error('SECRET_UNREADABLE') tanpa detail jika token rusak atau secret berubah. */
export function decryptSecret(token: string, secret: string): string {
  try {
    const [version, iv, tag, ciphertext] = token.split('.');
    if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error('format');
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(iv, 'base64url'));
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('SECRET_UNREADABLE');
  }
}

/** Empat karakter terakhir untuk tampilan tersamar. */
export const keyHint = (plain: string) => plain.slice(-4);
