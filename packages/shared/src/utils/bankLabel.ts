import { JP_BANKS } from "../data/jpBanks.js";
import { KR_BANKS } from "../data/krBanks.js";

const JP_NAME_BY_CODE = new Map(JP_BANKS.map((bank) => [bank.code, bank.nameJa]));
const KR_NAME_BY_CODE = new Map(KR_BANKS.map((bank) => [bank.code, bank.name]));

/**
 * 표시용 은행명.
 *
 * 저장된 bankName 은 등록 시점 라벨의 복사본이라 상호 변경을 따라가지 못한다
 * (2026-08-03 住信ＳＢＩネット銀行 → ドコモＳＭＴＢネット銀行). 식별자는 코드이므로
 * 표시할 때마다 현재 목록에서 다시 찾는다 — 데이터를 건드리지 않고 라벨만 최신이 된다.
 *
 * 목록에 없는 코드(폐지된 기관, 목록 갱신 전 등록분)는 저장값을 그대로 쓴다.
 */
export function bankLabel(
  country: "JP" | "KR",
  code: string,
  storedName: string,
): string {
  const table = country === "KR" ? KR_NAME_BY_CODE : JP_NAME_BY_CODE;
  return table.get(code) ?? storedName;
}
