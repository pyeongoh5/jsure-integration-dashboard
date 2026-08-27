import { InternalServerErrorException } from "@nestjs/common";
import { UploadsService } from "./uploads.service";

function makeService(apiPublicBaseUrl: string | undefined) {
  const r2 = {
    presignPut: jest.fn().mockResolvedValue("https://r2/put?sig=1"),
    publicUrl: jest.fn().mockReturnValue(null),
  };
  const config = {
    get: jest.fn().mockReturnValue(apiPublicBaseUrl),
  };
  const prisma = {} as never;
  return {
    service: new UploadsService(prisma, r2 as never, config as never),
    r2,
    config,
  };
}

describe("presignJwinMediaUpload", () => {
  it("API_PUBLIC_BASE_URL이 설정되어 있으면 이 API 자신의 영구 URL을 viewUrl로 반환한다", async () => {
    const { service } = makeService("http://localhost:3000/api");
    const result = await service.presignJwinMediaUpload({
      contentType: "video/mp4",
      sizeBytes: 1024,
    });
    const basename = result.objectKey.replace("jwin/media/", "");
    expect(result.viewUrl).toBe(
      `http://localhost:3000/api/uploads/jwin-media/${basename}`,
    );
    expect(result.viewUrl.endsWith(basename)).toBe(true);
    expect(result.uploadUrl).toContain("https://r2/put");
  });

  it("API_PUBLIC_BASE_URL 끝의 슬래시는 제거하고 조합한다", async () => {
    const { service } = makeService("http://localhost:3000/api/");
    const result = await service.presignJwinMediaUpload({
      contentType: "image/png",
      sizeBytes: 1024,
    });
    expect(result.viewUrl).not.toContain("/api//uploads");
  });

  it("API_PUBLIC_BASE_URL 미설정이면 발급을 막는다", async () => {
    const { service } = makeService(undefined);
    await expect(
      service.presignJwinMediaUpload({ contentType: "image/png", sizeBytes: 1024 }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
