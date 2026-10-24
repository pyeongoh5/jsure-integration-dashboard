import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { UpdateInfluencerProfileRequest } from "@jsure/shared";
import { InfluencerMeService } from "./influencer-me.service";
import type { PrismaService } from "../prisma/prisma.service";

const BASE_INPUT: UpdateInfluencerProfileRequest = {
  name: "山田花子",
  nameKana: "ヤマダハナコ",
  phone: "09012345678",
};

function makeService(updateResult: Promise<unknown> = Promise.resolve({})) {
  const prisma = {
    influencer: { update: jest.fn().mockReturnValue(updateResult) },
  };
  const service = new InfluencerMeService(prisma as unknown as PrismaService);
  return { prisma, service };
}

describe("인플루언서 프로필 수정", () => {
  it("이메일과 생년월일을 보내면 함께 갱신한다", async () => {
    const { prisma, service } = makeService();

    await service.updateProfile("inf-1", {
      ...BASE_INPUT,
      email: "nagisa@example.com",
      birthDate: "1995-03-07",
    });

    expect(prisma.influencer.update).toHaveBeenCalledWith({
      where: { id: "inf-1" },
      data: {
        name: BASE_INPUT.name,
        nameKana: BASE_INPUT.nameKana,
        phone: BASE_INPUT.phone,
        email: "nagisa@example.com",
        birthDate: new Date("1995-03-07T00:00:00Z"),
      },
    });
  });

  it("구버전 클라이언트처럼 이메일·생년월일이 없으면 두 컬럼을 건드리지 않는다", async () => {
    const { prisma, service } = makeService();

    await service.updateProfile("inf-1", BASE_INPUT);

    expect(prisma.influencer.update).toHaveBeenCalledWith({
      where: { id: "inf-1" },
      data: {
        name: BASE_INPUT.name,
        nameKana: BASE_INPUT.nameKana,
        phone: BASE_INPUT.phone,
      },
    });
  });

  it("이미 사용 중인 이메일이면 ConflictException 을 던진다", async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "test",
    });
    const { service } = makeService(Promise.reject(duplicate));

    await expect(
      service.updateProfile("inf-1", {
        ...BASE_INPUT,
        email: "taken@example.com",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
