import {
  generateTempPassword,
  isThrottled,
  RESET_THROTTLE_MS,
  TEMP_PASSWORD_LENGTH,
} from "./temp-password";

describe("generateTempPassword", () => {
  it("정해진 길이로 만든다", () => {
    expect(generateTempPassword()).toHaveLength(TEMP_PASSWORD_LENGTH);
  });

  it("헷갈리는 글자(0 O 1 l I 2 8 B Z)를 쓰지 않는다", () => {
    const joined = Array.from({ length: 50 }, generateTempPassword).join("");
    expect(joined).not.toMatch(/[0O1lI28BZ]/);
  });

  it("매번 다른 값을 만든다", () => {
    const values = new Set(Array.from({ length: 50 }, generateTempPassword));
    expect(values.size).toBe(50);
  });
});

describe("isThrottled", () => {
  it("이전 요청이 없으면 통과", () => {
    expect(isThrottled(undefined, 1_000)).toBe(false);
  });

  it("간격 안이면 막는다", () => {
    expect(isThrottled(1_000, 1_000 + RESET_THROTTLE_MS - 1)).toBe(true);
  });

  it("간격이 지나면 통과", () => {
    expect(isThrottled(1_000, 1_000 + RESET_THROTTLE_MS)).toBe(false);
  });
});
