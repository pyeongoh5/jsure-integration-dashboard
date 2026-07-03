import {
  extractVariableKeys,
  renderTemplate,
  validateBodyVariables,
} from "./template-renderer";
import type { TriggerVariableWithResolver } from "./trigger-meta";

const vars: TriggerVariableWithResolver[] = [
  {
    key: "name",
    label: "Name",
    description: "d",
    sample: "SAMPLE_NAME",
    resolver: () => "Alice",
  },
  {
    key: "title",
    label: "Title",
    description: "d",
    sample: "SAMPLE_TITLE",
    resolver: () => null,
  },
];

describe("extractVariableKeys", () => {
  it("본문 내 모든 {{key}} 를 추출", () => {
    expect(extractVariableKeys("Hi {{name}}, welcome to {{title}}!")).toEqual([
      "name",
      "title",
    ]);
  });

  it("중복 키는 한번만", () => {
    expect(extractVariableKeys("{{a}} {{a}} {{b}}")).toEqual(["a", "b"]);
  });

  it("공백 있는 문법도 매칭", () => {
    expect(extractVariableKeys("{{ name }}")).toEqual(["name"]);
  });

  it("빈 본문", () => {
    expect(extractVariableKeys("")).toEqual([]);
  });
});

describe("validateBodyVariables", () => {
  it("본문의 모든 변수가 허용 목록에 있으면 ok", () => {
    expect(validateBodyVariables("Hi {{name}} and {{title}}", vars)).toEqual({
      ok: true,
    });
  });

  it("허용 목록에 없는 변수 발견 시 unknown 배열 반환", () => {
    expect(validateBodyVariables("Hi {{name}} {{foo}}", vars)).toEqual({
      ok: false,
      unknown: ["foo"],
    });
  });

  it("여러 미지정 변수 모두 리턴", () => {
    expect(validateBodyVariables("{{foo}} {{bar}}", vars)).toEqual({
      ok: false,
      unknown: ["foo", "bar"],
    });
  });
});

describe("renderTemplate", () => {
  const ctx = {} as never;

  it("resolver 로 치환", () => {
    expect(renderTemplate("Hi {{name}}", vars, ctx)).toBe("Hi Alice");
  });

  it("resolver 가 null 을 반환하면 빈 문자열", () => {
    expect(renderTemplate("Hi {{title}}", vars, ctx)).toBe("Hi ");
  });

  it("허용 목록에 없는 변수는 원문 유지", () => {
    expect(renderTemplate("Hi {{unknown}}", vars, ctx)).toBe("Hi {{unknown}}");
  });

  it("샘플 모드에서는 sample 값을 사용", () => {
    expect(renderTemplate("Hi {{name}} {{title}}", vars, ctx, { useSample: true })).toBe(
      "Hi SAMPLE_NAME SAMPLE_TITLE",
    );
  });

  it("빈 본문은 그대로", () => {
    expect(renderTemplate("", vars, ctx)).toBe("");
  });
});
