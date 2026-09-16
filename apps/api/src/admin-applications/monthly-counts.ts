/**
 * 대시보드 "월별 캠페인 응모 추이" 집계 (UTC+9 = KST/JST 월 기준).
 * 어드민 사용자와 인플루언서가 모두 UTC+9 권역이라 월 경계를 +9시간으로 고정한다 —
 * 기존 화면이 브라우저 로컬(KST)로 세던 것과 같은 결과가 나온다.
 */

const UTC9_OFFSET_MS = 9 * 60 * 60 * 1000;

/** UTC+9 기준 "YYYY-MM" */
function monthKeyUtc9(date: Date): string {
  const shifted = new Date(date.getTime() + UTC9_OFFSET_MS);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${month}`;
}

/** UTC+9 기준으로 (이번 달 - offset)의 1일 0시를 UTC Date 로 */
export function monthStartUtc9(now: Date, monthsAgo: number): Date {
  const shifted = new Date(now.getTime() + UTC9_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() - monthsAgo, 1) - UTC9_OFFSET_MS,
  );
}

/** 최근 windowMonths 개월을 빈 달 포함 오름차순으로 채워 센다. */
export function bucketMonthlyCounts(
  appliedAts: Date[],
  now: Date,
  windowMonths: number,
): { month: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const appliedAt of appliedAts) {
    const key = monthKeyUtc9(appliedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const months: { month: string; count: number }[] = [];
  for (let offset = windowMonths - 1; offset >= 0; offset -= 1) {
    const key = monthKeyUtc9(new Date(monthStartUtc9(now, offset).getTime() + UTC9_OFFSET_MS));
    months.push({ month: key, count: counts.get(key) ?? 0 });
  }
  return months;
}
