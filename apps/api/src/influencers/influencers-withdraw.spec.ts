import { ConflictException, NotFoundException } from "@nestjs/common";
import { InfluencersService } from "./influencers.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuditService, AuditActor } from "../audit/audit.service";

const actor: AuditActor = { id: "admin-1", name: "운영자" };

function makeMocks(existing: { email: string } | null) {
  const prisma = {
    influencer: {
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue({}),
    },
    influencerSnsAccount: { deleteMany: jest.fn().mockResolvedValue({}) },
    influencerBankAccount: { deleteMany: jest.fn().mockResolvedValue({}) },
    influencerSession: { deleteMany: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new InfluencersService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { prisma, audit, service };
}

describe("인플루언서 탈퇴 처리", () => {
  it("PII 를 익명화하고 SNS·계좌·세션을 지우고 감사 로그를 남긴다", async () => {
    const { prisma, audit, service } = makeMocks({
      email: "nagisa@example.com",
    });

    await service.withdraw("inf-1", actor);

    expect(prisma.influencerSnsAccount.deleteMany).toHaveBeenCalledWith({
      where: { influencerId: "inf-1" },
    });
    expect(prisma.influencerBankAccount.deleteMany).toHaveBeenCalledWith({
      where: { influencerId: "inf-1" },
    });
    expect(prisma.influencerSession.deleteMany).toHaveBeenCalledWith({
      where: { influencerId: "inf-1" },
    });
    expect(prisma.influencer.update).toHaveBeenCalledWith({
      where: { id: "inf-1" },
      data: expect.objectContaining({
        email: "deleted+inf-1@invalid",
        passwordHash: null,
        lineUserId: null,
        name: "탈퇴 회원",
        nameKana: null,
        phone: "",
        birthDate: null,
        postalCode: "",
        prefecture: "",
        city: "",
        addressLine1: "",
        addressLine2: "",
        status: "SUSPENDED",
      }),
    });
    expect(audit.record).toHaveBeenCalledWith({
      action: "INFLUENCER_WITHDRAW",
      actor,
      influencerId: "inf-1",
    });
  });

  it("감사 로그 metadata 에 익명화 전 PII 를 남기지 않는다", async () => {
    const { audit, service } = makeMocks({ email: "nagisa@example.com" });

    await service.withdraw("inf-1", actor);

    const recorded = audit.record.mock.calls[0][0];
    expect(JSON.stringify(recorded)).not.toContain("nagisa@example.com");
  });

  it("없는 인플루언서면 404", async () => {
    const { service } = makeMocks(null);
    await expect(service.withdraw("ghost", actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("이미 탈퇴한 회원이면 409 — 재실행해도 아무것도 바꾸지 않는다", async () => {
    const { prisma, service } = makeMocks({
      email: "deleted+inf-1@invalid",
    });
    await expect(service.withdraw("inf-1", actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
