/**
 * 매직 바이트로 실제 미디어 포맷을 판별한다.
 *
 * 브라우저의 File.type 과 서버 응답의 content-type 은 **확장자·헤더 기반이라 거짓말을 한다** —
 * AVIF 파일이 .png 확장자로 올라오면 image/png 으로 통과해 X 미디어 업로드에서
 * "media type unrecognized"(400) 로 게시가 실패한다 (2026-09-19 운영 실측).
 * 그래서 업로드(화면)와 게시(서버) 양쪽 모두 바이트를 직접 본다.
 */

export type MediaFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'mp4' | 'avif' | 'unknown';

/** X 게시에 쓸 수 있는 포맷 (JWIN_MEDIA_ALLOWED_CONTENT_TYPES 와 대응) */
export const X_POSTABLE_FORMATS: readonly MediaFormat[] = ['png', 'jpeg', 'gif', 'webp', 'mp4'];

export const MEDIA_FORMAT_CONTENT_TYPES: Record<Exclude<MediaFormat, 'unknown'>, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  avif: 'image/avif',
};

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/** 첫 16바이트 정도면 충분하다. */
export function sniffMediaFormat(bytes: Uint8Array): MediaFormat {
  if (bytes.length < 12) return 'unknown';
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (ascii(bytes, 0, 4) === 'GIF8') return 'gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    // avif/avis(시퀀스)·heic 계열은 X 가 받지 않는다
    if (brand.startsWith('avi') || brand.startsWith('hei') || brand.startsWith('mif')) {
      return 'avif';
    }
    return 'mp4';
  }
  return 'unknown';
}
