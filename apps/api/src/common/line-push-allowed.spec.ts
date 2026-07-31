import { linePushAllowed } from "./line-push-allowed";

describe("linePushAllowed", () => {
  it("프로덕션은 항상 발송을 허용한다", () => {
    expect(linePushAllowed({ NODE_ENV: "production" })).toBe(true);
  });

  it("프로덕션이 아니면 기본적으로 막는다", () => {
    expect(linePushAllowed({})).toBe(false);
    expect(linePushAllowed({ NODE_ENV: "development" })).toBe(false);
    expect(linePushAllowed({ NODE_ENV: "test" })).toBe(false);
  });

  it("LINE_PUSH_ENABLED=true 로 명시하면 프로덕션 외에서도 허용한다", () => {
    expect(
      linePushAllowed({ NODE_ENV: "development", LINE_PUSH_ENABLED: "true" }),
    ).toBe(true);
    // 오타/다른 값은 열리지 않는다.
    expect(
      linePushAllowed({ NODE_ENV: "development", LINE_PUSH_ENABLED: "1" }),
    ).toBe(false);
  });
});
