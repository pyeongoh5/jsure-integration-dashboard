import { Test } from "@nestjs/testing";
import { PrismaService } from "./prisma/prisma.service";

/**
 * Nest 컨테이너를 실제로 조립해 DI 그래프 전체를 검증한다.
 * 모듈 순환, export 누락, 주입 불가 provider 는 전부 여기서 드러난다 —
 * 타입체크로는 하나도 걸리지 않고 서버를 띄워야만 보이는 것들이다.
 *
 * compile() 은 onModuleInit 을 부르지 않으므로 DB 에 연결하지 않는다.
 * PrismaService 는 생성자에서 PrismaClient 를 만들기 때문에 override 한다.
 */
describe("애플리케이션 부팅", () => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = { ...originalEnv, JWT_SECRET: "test-secret" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("AppModule 이 조립된다", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [(await import("./app.module")).AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
