import { z } from "zod";
import type { AddressCountry } from "./influencer.js";

/**
 * 거주지 구분 — 캠페인 발송 가능 여부를 목록에서 바로 판단하기 위한 값.
 * NONE 은 배송지를 아직 등록하지 않은 회원이다.
 */
export const ResidenceSchema = z.enum(["KR", "JP", "NONE"]);
export type Residence = z.infer<typeof ResidenceSchema>;

/**
 * 배송지 주소에서 거주지 구분을 판정한다. 이 규칙이 유일한 출처다.
 *
 * addressCountry 만으로는 부족하다 — 기본값이 JP 라서 주소를 한 번도 입력하지
 * 않은 회원과 실제 일본 거주자가 같은 값을 갖는다. 우편번호는 주소를 저장해야만
 * 채워지므로(DB 기본값이 빈 문자열) 미등록 판정의 근거로 쓴다. 저장 시 국가별
 * 형식 검증을 통과하므로 공백만 든 값은 들어올 수 없다.
 *
 * 서버 목록 필터는 같은 규칙을 각자의 질의 형태로 다시 쓴다 —
 * influencers.service.ts(Prisma where)와 applicant-filter.sql.ts(raw SQL).
 * 여기를 고치면 그 두 곳도 함께 고쳐야 목록과 표기가 어긋나지 않는다.
 */
export function residenceOf(address: {
  addressCountry: AddressCountry;
  postalCode: string;
}): Residence {
  if (address.postalCode === "") return "NONE";
  return address.addressCountry === "KR" ? "KR" : "JP";
}
