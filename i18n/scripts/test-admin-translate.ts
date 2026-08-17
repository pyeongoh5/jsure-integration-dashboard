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

console.log("[i18n] translate 셀프체크 통과");
