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
