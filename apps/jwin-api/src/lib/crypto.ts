import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from '../config';

// AES-256-GCM. 저장 포맷: base64(iv).base64(tag).base64(ciphertext)
// 대상: X access/refresh 토큰, 기프트코드 원문, 배송지 JSON

function key(): Buffer {
  return Buffer.from(config().TOKEN_ENCRYPTION_KEY, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decrypt(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('invalid ciphertext format');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
