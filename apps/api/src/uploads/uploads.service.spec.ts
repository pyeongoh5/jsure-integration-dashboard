import { UploadsService } from "./uploads.service";

function makeService(r2: {
  publicUrl?: (objectKey: string) => string | null;
  presignGet?: (objectKey: string) => Promise<string>;
}): UploadsService {
  const stub = {
    publicUrl: r2.publicUrl ?? (() => null),
    presignGet: r2.presignGet ?? (async () => "https://signed.example/x"),
  } as never;
  return new UploadsService({} as never, stub);
}

describe("resolveCampaignThumbnailUrl", () => {
  it("presign 실패는 null 로 흡수한다 — 썸네일 하나로 목록 응답이 500 이 되면 안 된다", async () => {
    const service = makeService({
      presignGet: async () => {
        throw new Error("R2가 설정되지 않았습니다");
      },
    });

    await expect(
      service.resolveCampaignThumbnailUrl("campaigns/thumb.png"),
    ).resolves.toBeNull();
  });

  it("공개 URL 이 있으면 presign 하지 않는다", async () => {
    let presigned = false;
    const service = makeService({
      publicUrl: () => "https://cdn.example/campaigns/thumb.png",
      presignGet: async () => {
        presigned = true;
        return "https://signed.example/x";
      },
    });

    await expect(
      service.resolveCampaignThumbnailUrl("campaigns/thumb.png"),
    ).resolves.toBe("https://cdn.example/campaigns/thumb.png");
    expect(presigned).toBe(false);
  });

  it("이미 외부 URL 이거나 빈 값이면 그대로 돌려준다", async () => {
    const service = makeService({});

    await expect(
      service.resolveCampaignThumbnailUrl("https://example.com/a.png"),
    ).resolves.toBe("https://example.com/a.png");
    await expect(service.resolveCampaignThumbnailUrl(null)).resolves.toBeNull();
  });
});

describe("resolveR2ImagesInHtml", () => {
  it("변환 실패한 키는 원문 r2: 토큰으로 남긴다", async () => {
    const service = makeService({
      presignGet: async () => {
        throw new Error("R2가 설정되지 않았습니다");
      },
    });

    const html = '<p>본문</p><img src="r2:campaigns/body-1.png">';
    await expect(service.resolveR2ImagesInHtml(html)).resolves.toBe(html);
  });

  it("성공한 키는 presigned URL 로 치환하고 원본 키를 보존한다", async () => {
    const service = makeService({
      presignGet: async () => "https://signed.example/body-1.png",
    });

    const resolved = await service.resolveR2ImagesInHtml(
      '<img src="r2:campaigns/body-1.png">',
    );

    expect(resolved).toContain('src="https://signed.example/body-1.png"');
    expect(resolved).toContain('data-r2-key="campaigns/body-1.png"');
  });
});
