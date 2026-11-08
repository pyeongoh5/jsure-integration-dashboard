import "reflect-metadata";
import { AppModule } from "./app.module";

type ModuleClass = { name: string };

/** 안을 들여다볼 수 없어 검사하지 않는 import 자리. undefined 와 구분해야 한다. */
const SKIPPED: ModuleClass = { name: "<deferred>" };

/**
 * Nest 모듈의 imports 메타데이터를 그대로 돌려준다.
 * DynamicModule(JwtModule.registerAsync 등)은 클래스가 아니라 객체라서
 * module 필드로 실제 클래스를 꺼낸다.
 *
 * undefined 를 걸러내지 않는 게 핵심이다 — 순환 import 는 "A 가 B 를 가리키는
 * 고리"가 아니라 "평가 시점에 아직 정의되지 않은 undefined" 로 나타난다.
 */
function importsOf(moduleClass: ModuleClass): (ModuleClass | undefined)[] {
  const imports: unknown[] =
    Reflect.getMetadata("imports", moduleClass as object) ?? [];
  return imports.map((entry) => {
    if (typeof entry === "function") return entry as ModuleClass;
    if (entry && typeof entry === "object") {
      // Promise<DynamicModule> (ConfigModule.forRoot 등) — Nest 가 정상 지원하는
      // 형태지만 await 전에는 안을 볼 수 없다. 검사 대상에서 빼야 오탐이 없다.
      if ("then" in entry) return SKIPPED;
      if ("module" in entry) return (entry as { module: ModuleClass }).module;
    }
    return undefined;
  });
}

/** `부모 → imports[인덱스]` 형태로, 값이 비어 있는 import 자리를 모두 찾는다. */
function findEmptyImports(root: ModuleClass): string[] {
  const visited = new Set<ModuleClass>();
  const broken: string[] = [];

  function walk(current: ModuleClass): void {
    if (visited.has(current)) return;
    visited.add(current);
    importsOf(current).forEach((imported, index) => {
      if (imported === SKIPPED) return;
      if (!imported) {
        broken.push(`${current.name} → imports[${index}]`);
        return;
      }
      walk(imported);
    });
  }

  walk(root);
  return broken;
}

describe("모듈 그래프", () => {
  /**
   * forwardRef 없는 순환 import 는 Nest 부팅을 통째로 실패시킨다
   * ("the module at index [N] of the X 'imports' array is undefined").
   * 타입체크로도 단위 테스트로도 전혀 걸리지 않아 서버를 띄워야만 드러나므로,
   * 그래프를 여기서 검사한다.
   *
   * 실제로 InfluencersModule → LineTemplatesModule → InfluencerAuthModule →
   * InfluencersModule 고리를 만들어 부팅이 깨진 적이 있다.
   */
  it("import 가 undefined 인 자리가 없다 (순환 import 의 증상)", () => {
    expect(findEmptyImports(AppModule as unknown as ModuleClass)).toEqual([]);
  });
});
