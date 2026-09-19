import { describe, expect, it } from 'vitest';
import { sniffMediaFormat } from './mediaFormat';

function bytesOf(...parts: (string | number[])[]): Uint8Array {
  const flat: number[] = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      for (const char of part) flat.push(char.charCodeAt(0));
    } else {
      flat.push(...part);
    }
  }
  while (flat.length < 16) flat.push(0);
  return Uint8Array.from(flat);
}

describe('sniffMediaFormat', () => {
  it('png/jpeg/gif/webp 를 매직 바이트로 판별한다', () => {
    expect(sniffMediaFormat(bytesOf([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(sniffMediaFormat(bytesOf([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(sniffMediaFormat(bytesOf('GIF89a'))).toBe('gif');
    expect(sniffMediaFormat(bytesOf('RIFF', [0, 0, 0, 0], 'WEBP'))).toBe('webp');
  });

  it('확장자가 .png 여도 AVIF 바이트면 avif — 게시 실패의 실제 사례', () => {
    // 운영 실측 헤더: 00 00 00 20 66 74 79 70 61 76 69 66 (....ftypavif)
    expect(
      sniffMediaFormat(bytesOf([0x00, 0x00, 0x00, 0x20], 'ftypavif')),
    ).toBe('avif');
  });

  it('ftyp 이지만 avif/heic 계열이 아니면 mp4 로 본다', () => {
    expect(sniffMediaFormat(bytesOf([0x00, 0x00, 0x00, 0x18], 'ftypisom'))).toBe('mp4');
  });

  it('모르는 바이트·짧은 입력은 unknown', () => {
    expect(sniffMediaFormat(bytesOf('hello world!'))).toBe('unknown');
    expect(sniffMediaFormat(Uint8Array.from([1, 2, 3]))).toBe('unknown');
  });
});
