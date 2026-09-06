import assert from "node:assert";
import { translate } from "../admin/index";

assert.strictEqual(translate("common.languageName", "ko"), "한국어");
assert.strictEqual(translate("common.languageName", "ja"), "日本語");

// 보간: {name} 치환, 없는 파라미터는 원문 유지
const replaced = "총 {count}건".replace(/\{(\w+)\}/g, (match, name: string) =>
  name === "count" ? "3" : match,
);
assert.strictEqual(replaced, "총 3건");

assert.throws(() => translate("common.languageName", "xx" as never));

// 숫자 파라미터는 언어별 천단위 구분자를 붙인다.
assert.strictEqual(translate("pages.influencers.totalCount", "ko", { count: 1250 }), "총 1,250명");
assert.strictEqual(translate("pages.influencers.totalCount", "en", { count: 1250 }), "1,250 total");
assert.strictEqual(translate("pages.influencers.totalCount", "ja", { count: 1250 }), "全1,250名");

// 1000 미만은 구분자가 붙지 않는다.
assert.strictEqual(translate("pages.influencers.totalCount", "ko", { count: 420 }), "총 420명");

// 문자열 파라미터는 손대지 않는다 — 계좌·운송장 번호처럼 구분자가 붙으면 안 되는 값.
assert.strictEqual(
  translate("pages.influencers.totalCount", "ko", { count: "1250" }),
  "총 1250명",
);

console.log("[i18n] translate 셀프체크 통과");
