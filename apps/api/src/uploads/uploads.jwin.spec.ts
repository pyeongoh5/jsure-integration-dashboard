import { InternalServerErrorException } from "@nestjs/common";
import { UploadsService } from "./uploads.service";

function makeService(publicUrl: string | null) {
  const r2 = {
    presignPut: jest.fn().mockResolvedValue("https://r2/put?sig=1"),
    publicUrl: jest.fn().mockReturnValue(publicUrl),
  };
  const prisma = {} as never;
  return { service: new UploadsService(prisma, r2 as never), r2 };
}

describe("presignJwinMediaUpload", () => {
  it("공개 URL이 있으면 viewUrl로 반환한다", async () => {
    const { service } = makeService("https://cdn.example.com/jwin/media/x.mp4");
    const result = await service.presignJwinMediaUpload({
      contentType: "video/mp4",
      sizeBytes: 1024,
    });
    expect(result.viewUrl).toBe("https://cdn.example.com/jwin/media/x.mp4");
    expect(result.uploadUrl).toContain("https://r2/put");
  });

  it("R2_PUBLIC_BASE_URL 미설정(publicUrl=null)이면 실패시킨다", async () => {
    const { service } = makeService(null);
    await expect(
      service.presignJwinMediaUpload({ contentType: "image/png", sizeBytes: 1024 }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
