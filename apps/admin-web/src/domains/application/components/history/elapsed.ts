const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * 직전(더 오래된) 액션에서 경과한 시간. 상태 간 병목(승인 후 발송 지연 등)을
 * 한눈에 보기 위한 표기라 단위 하나로만 거칠게 반올림한다.
 * 1분 미만은 의미가 없어 null — 호출부가 표시를 생략한다.
 */
export function formatElapsedSince(
  previousIsoString: string,
  currentIsoString: string,
): string | null {
  const deltaMs =
    new Date(currentIsoString).getTime() - new Date(previousIsoString).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < MINUTE_MS) return null;
  if (deltaMs < HOUR_MS) return `+${Math.floor(deltaMs / MINUTE_MS)}분`;
  if (deltaMs < DAY_MS) return `+${Math.floor(deltaMs / HOUR_MS)}시간`;
  return `+${Math.floor(deltaMs / DAY_MS)}일`;
}
