import { describe, expect, it } from "vitest";
import { parseCodesInput, summarizeCodeInput } from "./jwinCodeInput";

describe("parseCodesInput", () => {
  it("개행으로 구분된 코드를 나눈다", () => {
    expect(parseCodesInput("AAA\nBBB\nCCC")).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("엑셀 열 붙여넣기(탭·CRLF)를 나눈다", () => {
    expect(parseCodesInput("AAA\r\nBBB\tCCC")).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("쉼표 구분과 앞뒤 공백을 처리한다", () => {
    expect(parseCodesInput(" AAA , BBB ")).toEqual(["AAA", "BBB"]);
  });

  it("빈 줄은 세지 않는다", () => {
    expect(parseCodesInput("AAA\n\n\nBBB\n")).toEqual(["AAA", "BBB"]);
  });

  it("빈 입력은 빈 배열", () => {
    expect(parseCodesInput("")).toEqual([]);
    expect(parseCodesInput("   \n  ")).toEqual([]);
  });
});

describe("summarizeCodeInput", () => {
  it("개수를 센다", () => {
    expect(summarizeCodeInput("AAA\nBBB\nCCC").count).toBe(3);
  });

  it("중복 코드를 잡아낸다(서버가 400으로 거부하는 조건)", () => {
    const summary = summarizeCodeInput("AAA\nBBB\nAAA\nAAA");
    expect(summary.count).toBe(4);
    expect(summary.duplicates).toEqual(["AAA"]);
  });

  it("중복이 없으면 빈 배열", () => {
    expect(summarizeCodeInput("AAA\nBBB").duplicates).toEqual([]);
  });
});
