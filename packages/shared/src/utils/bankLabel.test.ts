import { describe, expect, it } from "vitest";
import { bankLabel } from "./bankLabel.js";

describe("bankLabel", () => {
  it("상호가 바뀐 은행은 저장값 대신 현재 명칭을 쓴다", () => {
    expect(bankLabel("JP", "0038", "住信ＳＢＩネット銀行")).toBe("ドコモＳＭＴＢネット銀行");
    // 반각으로 저장된 옛 행도 같은 결과
    expect(bankLabel("JP", "0038", "住信SBIネット銀行")).toBe("ドコモＳＭＴＢネット銀行");
  });

  it("한국 계좌는 한국 목록에서 찾는다", () => {
    expect(bankLabel("KR", "004", "국민은행")).toBe("KB국민은행");
  });

  it("코드가 겹쳐도 국가별 목록을 섞지 않는다", () => {
    // "004" 는 한국 KB국민은행. 일본 목록엔 없으므로 저장값이 남는다
    expect(bankLabel("JP", "004", "어떤은행")).toBe("어떤은행");
  });

  it("목록에 없는 코드는 저장값을 그대로 쓴다", () => {
    expect(bankLabel("JP", "9999", "폐지된은행")).toBe("폐지된은행");
  });
});
