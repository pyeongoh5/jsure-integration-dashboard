/**
 * 어드민은 JST로 날짜시각을 입력하고, 서버에는 UTC ISO로 보낸다 (MVP_PLAN §3.3).
 * datetime-local 입력값 형식은 "YYYY-MM-DDTHH:mm".
 */

/** UTC ISO → JST datetime-local ("YYYY-MM-DDTHH:mm") */
export function utcIsoToJstLocal(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

/** JST datetime-local ("YYYY-MM-DDTHH:mm") → UTC ISO */
export function jstLocalToUtcIso(local: string): string {
  return new Date(`${local}:00+09:00`).toISOString();
}

/**
 * 캠페인 기간은 일 단위 — 시작일 JST 0시 ~ 종료일 JST 23:59:59 로 고정하고
 * 폼에서는 날짜("YYYY-MM-DD")만 입력받는다.
 */

/** UTC ISO → JST 달력 날짜 ("YYYY-MM-DD") */
export function utcIsoToJstDate(iso: string): string {
  return utcIsoToJstLocal(iso).slice(0, 10);
}

/** JST 날짜 → 그날 0시(JST)의 UTC ISO */
export function jstDateStartUtcIso(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

/** JST 날짜 → 그날 23:59:59(JST)의 UTC ISO */
export function jstDateEndUtcIso(date: string): string {
  return new Date(`${date}T23:59:59+09:00`).toISOString();
}
