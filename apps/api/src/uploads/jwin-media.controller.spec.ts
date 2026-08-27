import { NotFoundException } from "@nestjs/common";
import { JwinMediaController } from "./jwin-media.controller";

function makeController() {
  const r2 = {
    presignGet: jest.fn().mockResolvedValue("https://r2/get?sig=1"),
  };
  return { controller: new JwinMediaController(r2 as never), r2 };
}

describe("JwinMediaController", () => {
  const validObjectName = "550e8400-e29b-41d4-a716-446655440000.png";

  it("유효한 objectName이면 presigned GET URL로 302 리다이렉트한다", async () => {
    const { controller, r2 } = makeController();
    const result = await controller.getMedia(validObjectName);
    expect(result).toEqual({ url: "https://r2/get?sig=1", statusCode: 302 });
    expect(r2.presignGet).toHaveBeenCalledWith(
      `jwin/media/${validObjectName}`,
      expect.any(Number),
    );
  });

  it("경로 순회 시도가 포함된 이름은 R2를 호출하지 않고 404를 던진다", async () => {
    const { controller, r2 } = makeController();
    await expect(
      controller.getMedia("../../etc/passwd"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(r2.presignGet).not.toHaveBeenCalled();
  });

  it("허용되지 않은 확장자는 R2를 호출하지 않고 404를 던진다", async () => {
    const { controller, r2 } = makeController();
    await expect(
      controller.getMedia("550e8400-e29b-41d4-a716-446655440000.exe"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(r2.presignGet).not.toHaveBeenCalled();
  });

  it("UUID 형태가 아닌 이름은 R2를 호출하지 않고 404를 던진다", async () => {
    const { controller, r2 } = makeController();
    await expect(controller.getMedia("not-a-uuid.png")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(r2.presignGet).not.toHaveBeenCalled();
  });
});
