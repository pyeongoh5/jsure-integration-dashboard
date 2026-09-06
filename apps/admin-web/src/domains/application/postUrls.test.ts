import { describe, it, expect } from "vitest";
import { postUrls } from "@jsure/shared";

/**
 * 제출 URL 은 대표(url) + 나머지(extraUrls) 로 나뉘어 저장된다.
 * 읽는 쪽은 전부 이 헬퍼를 거치므로 여기서 순서와 빈 값 처리를 지킨다.
 */
describe("postUrls", () => {
  it("url 이 null 이면 빈 배열", () => {
    expect(postUrls({ url: null, extraUrls: [] })).toEqual([]);
  });

  it("extraUrls 가 없으면 대표 URL 하나", () => {
    expect(postUrls({ url: "https://a.test" })).toEqual(["https://a.test"]);
  });

  it("대표 URL 다음에 extraUrls 를 제출 순서대로 잇는다", () => {
    expect(
      postUrls({
        url: "https://a.test",
        extraUrls: ["https://b.test", "https://c.test"],
      }),
    ).toEqual(["https://a.test", "https://b.test", "https://c.test"]);
  });

  it("빈 문자열은 걸러낸다", () => {
    expect(postUrls({ url: "", extraUrls: ["https://b.test", ""] })).toEqual([
      "https://b.test",
    ]);
  });
});
