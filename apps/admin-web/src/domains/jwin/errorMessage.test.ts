import { describe, it, expect } from "vitest";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { jwinErrorMessage } from "./errorMessage";

describe("jwinErrorMessage", () => {
  it("axios 에러 — 한국어 메시지 있음 → 그대로 반환", () => {
    const error = new AxiosError();
    error.response = {
      data: { error: "코드 수(3)가 수량(5)과 일치하지 않습니다" },
      status: 400,
      statusText: "Bad Request",
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    };

    const result = jwinErrorMessage(error, "예비 메시지");
    expect(result).toBe("코드 수(3)가 수량(5)과 일치하지 않습니다");
  });

  it("axios 에러 — zod flatten 객체 → fallback 반환", () => {
    const error = new AxiosError();
    error.response = {
      data: { error: { fieldErrors: { codesText: ["error"] } } },
      status: 400,
      statusText: "Bad Request",
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    };

    const result = jwinErrorMessage(error, "검증 오류가 발생했습니다");
    expect(result).toBe("검증 오류가 발생했습니다");
  });

  it("axios 에러 — 공백만 있는 에러 → fallback 반환", () => {
    const error = new AxiosError();
    error.response = {
      data: { error: "   " },
      status: 400,
      statusText: "Bad Request",
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    };

    const result = jwinErrorMessage(error, "네트워크 오류");
    expect(result).toBe("네트워크 오류");
  });

  it("axios 에러 — response 없음(네트워크 오류) → fallback 반환", () => {
    const error = new AxiosError("Network Error");
    // response 를 설정하지 않음 (네트워크 오류)
    error.response = undefined;

    const result = jwinErrorMessage(error, "네트워크 오류입니다");
    expect(result).toBe("네트워크 오류입니다");
  });

  it("일반 Error → Error.message 반환", () => {
    const error = new Error("boom");

    const result = jwinErrorMessage(error, "예비 메시지");
    expect(result).toBe("boom");
  });

  it("일반 Error — 공백 메시지 → fallback 반환", () => {
    const error = new Error("   ");

    const result = jwinErrorMessage(error, "예비 메시지");
    expect(result).toBe("예비 메시지");
  });

  it("던져진 문자열 → fallback 반환", () => {
    const result = jwinErrorMessage("어떤 문자열", "번역된 메시지");
    expect(result).toBe("번역된 메시지");
  });

  it("객체 → fallback 반환", () => {
    const result = jwinErrorMessage({ some: "object" }, "예비 메시지");
    expect(result).toBe("예비 메시지");
  });

  it("null → fallback 반환", () => {
    const result = jwinErrorMessage(null, "예비 메시지");
    expect(result).toBe("예비 메시지");
  });
});
