/**
 * 캐러셀 슬라이드 비율 판정 (운영 실측 2026-09-19: 9:16 + 4:5 조합이
 * 카드 생성에서 400 INVALID_ASPECT_RATIO 로 거부됐다).
 *
 * X 캐러셀 규칙: 모든 슬라이드가 같은 비율이어야 하고, 비율은 1:1 또는 1.91:1 만
 * 허용된다. 게시 시점에야 X 가 거부하면 매일 게시가 조용히 실패하므로
 * 소재 저장 전에 브라우저에서 이미지 크기를 읽어 검사한다.
 */

const SUPPORTED_RATIOS = [1, 1.91];
/** 픽셀 반올림 오차 허용 (800x419 같은 근사값도 1.91:1 로 인정) */
const RATIO_TOLERANCE = 0.03;

function isSupported(ratio: number): boolean {
  return SUPPORTED_RATIOS.some((supported) => Math.abs(ratio - supported) <= supported * RATIO_TOLERANCE);
}

export type CarouselRatioIssue = 'UNSUPPORTED' | 'MISMATCH' | null;

/** 순수 판정 — 크기 목록을 받아 문제 유형을 돌려준다. */
export function carouselRatioIssue(sizes: { width: number; height: number }[]): CarouselRatioIssue {
  const ratios = sizes.map((size) => size.width / size.height);
  if (ratios.some((ratio) => !isSupported(ratio))) return 'UNSUPPORTED';
  const [first, ...rest] = ratios;
  if (rest.some((ratio) => Math.abs(ratio - (first as number)) > (first as number) * RATIO_TOLERANCE)) {
    return 'MISMATCH';
  }
  return null;
}

function loadImageSize(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/**
 * 업로드된 이미지 URL 들의 비율을 검사한다. 크기를 읽지 못한 URL(동영상 등)은
 * 건너뛴다 — 최종 방어선은 게시 시점의 X 응답이고 이건 등록 시점의 조기 경보다.
 */
export async function checkCarouselRatios(urls: string[]): Promise<CarouselRatioIssue> {
  const sizes = (await Promise.all(urls.map(loadImageSize))).filter(
    (size): size is { width: number; height: number } => size !== null,
  );
  if (sizes.length === 0) return null;
  return carouselRatioIssue(sizes);
}
