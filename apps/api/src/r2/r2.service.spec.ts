import { ConfigService } from "@nestjs/config";
import { R2Service } from "./r2.service";

function makeService(env: Record<string, string>): R2Service {
  const config = { get: (key: string) => env[key] } as ConfigService;
  const service = new R2Service(config);
  service.onModuleInit();
  return service;
}

const BASE_ENV = {
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "public-bucket",
  R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
};

describe("R2Service — 버킷 라우팅·공개 URL", () => {
  it("공개 키는 R2_PUBLIC_BASE_URL 기반 영구 URL", () => {
    const service = makeService({
      ...BASE_ENV,
      R2_PUBLIC_BASE_URL: "https://cdn.example.com/",
    });
    expect(service.publicUrl("campaigns/a.png")).toBe(
      "https://cdn.example.com/campaigns/a.png",
    );
    expect(service.publicUrl("notices/b.png")).toBe(
      "https://cdn.example.com/notices/b.png",
    );
  });

  it("비공개 키(insights/, attachments/)는 공개 URL 발급 금지", () => {
    const service = makeService({
      ...BASE_ENV,
      R2_PUBLIC_BASE_URL: "https://cdn.example.com",
    });
    expect(service.publicUrl("insights/app-1/INSTAGRAM/x.png")).toBeNull();
    expect(service.publicUrl("attachments/app-1/ORDER_RECEIPT/y.png")).toBeNull();
  });

  it("R2_PUBLIC_BASE_URL 미설정이면 공개 키도 null (presign fallback 용)", () => {
    const service = makeService(BASE_ENV);
    expect(service.publicUrl("campaigns/a.png")).toBeNull();
  });

  it("presign URL 의 버킷이 키 프리픽스에 따라 분리된다", async () => {
    const service = makeService({
      ...BASE_ENV,
      R2_PRIVATE_BUCKET: "private-bucket",
    });
    const publicUrl = await service.presignGet("campaigns/a.png");
    const privateUrl = await service.presignGet("insights/app-1/x.png");
    expect(new URL(publicUrl).hostname).toMatch(/^public-bucket\./);
    expect(new URL(privateUrl).hostname).toMatch(/^private-bucket\./);
  });

  it("R2_PRIVATE_BUCKET 미설정이면 단일 버킷 (하위 호환)", async () => {
    const service = makeService(BASE_ENV);
    const privateUrl = await service.presignGet("insights/app-1/x.png");
    expect(new URL(privateUrl).hostname).toMatch(/^public-bucket\./);
  });
});
