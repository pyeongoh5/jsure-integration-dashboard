import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InfluencersController } from "./influencers.controller";
import { InfluencersService } from "./influencers.service";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuditService, AuditActor } from "../audit/audit.service";
import type { LineDispatcherService } from "../line-templates/line-dispatcher.service";

const actor: AuditActor = { id: "admin-1", name: "운영자" };

function makeMocks(
  existing:
    | {
        email: string;
        /** 익명화가 지우기 전의 보유 채널 — 생략 시 없음. */
        snsAccounts?: {
          snsType: string;
          handle: string;
          followerCount: number;
        }[];
      }
    | null,
  pending: { id: string } | null = null,
) {
  const prisma = {
    influencer: {
      findUnique: jest.fn().mockResolvedValue(
        existing && {
          name: "나기사",
          lineUserId: "U1",
          snsAccounts: [],
          ...existing,
        },
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    influencerWithdrawal: {
      findFirst: jest.fn().mockResolvedValue(pending),
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
  const dispatcher = { dispatchCommon: jest.fn().mockResolvedValue(undefined) };
  const service = new InfluencersService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    dispatcher as unknown as LineDispatcherService,
  );
  return { prisma, audit, dispatcher, service };
}

describe("탈퇴 SNS 스냅샷", () => {
  const withAccounts = {
    email: "nagisa@example.com",
    snsAccounts: [
      { snsType: "INSTAGRAM", handle: "@nagisa", followerCount: 1200 },
      { snsType: "TIKTOK", handle: "@nagisa_tt", followerCount: 300 },
    ],
  };

  it("계정을 지우기 전의 채널·팔로워를 승인 기록에 남긴다", async () => {
    const { prisma, service } = makeMocks(withAccounts, { id: "wd-1" });

    await service.withdraw("inf-1", actor);

    expect(prisma.influencerWithdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wd-1" },
        data: expect.objectContaining({
          decision: "APPROVED",
          snsSnapshot: [
            { snsType: "INSTAGRAM", followerCount: 1200 },
            { snsType: "TIKTOK", followerCount: 300 },
          ],
        }),
      }),
    );
  });

  // 탈퇴는 PII 익명화다. 핸들은 그 자체로 개인 식별자라 분석용 스냅샷에 들어가면 안 된다.
  it("핸들은 스냅샷에 담지 않는다", async () => {
    const { prisma, service } = makeMocks(withAccounts, { id: "wd-1" });

    await service.withdraw("inf-1", actor);

    const snapshot = JSON.stringify(
      prisma.influencerWithdrawal.update.mock.calls[0]?.[0],
    );
    expect(snapshot).not.toContain("@nagisa");
    expect(snapshot).not.toContain("handle");
  });

  it("보유 채널이 없으면 빈 배열로 남긴다", async () => {
    const { prisma, service } = makeMocks(
      { email: "nagisa@example.com" },
      { id: "wd-1" },
    );

    await service.withdraw("inf-1", actor);

    expect(prisma.influencerWithdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ snsSnapshot: [] }),
      }),
    );
  });
});

describe("인플루언서 탈퇴 처리", () => {
  it("PII 를 익명화하고 SNS·계좌·세션을 지우고 감사 로그를 남긴다", async () => {
    const { prisma, audit, service } = makeMocks(
      { email: "nagisa@example.com" },
      { id: "wd-1" },
    );

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
      metadata: { fromRequest: true },
    });
  });

  it("감사 로그 metadata 에 익명화 전 PII 를 남기지 않는다", async () => {
    const { audit, service } = makeMocks(
      { email: "nagisa@example.com" },
      { id: "wd-1" },
    );

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

describe("셀프 탈퇴 신청의 승인", () => {
  it("대기 중인 신청을 APPROVED 로 닫고 처리 관리자를 남긴다", async () => {
    const { prisma, service } = makeMocks(
      { email: "nagisa@example.com" },
      { id: "wd-1" },
    );

    await service.withdraw("inf-1", actor);

    expect(prisma.influencerWithdrawal.update).toHaveBeenCalledWith({
      where: { id: "wd-1" },
      data: expect.objectContaining({
        decision: "APPROVED",
        decidedById: "admin-1",
      }),
    });
  });

  it("익명화 전에 읽어둔 이름·lineUserId 로 LINE 안내를 보낸다", async () => {
    const { prisma, dispatcher, service } = makeMocks(
      { email: "nagisa@example.com" },
      { id: "wd-1" },
    );

    await service.withdraw("inf-1", actor);

    // 익명화가 이 값들을 지우므로, 트랜잭션 전에 읽은 스냅샷을 넘겨야 한다.
    expect(dispatcher.dispatchCommon).toHaveBeenCalledWith(
      "COMMON_WITHDRAWAL_APPROVED",
      { influencer: { id: "inf-1", name: "나기사", lineUserId: "U1" } },
    );
    // 발송은 탈퇴가 실제로 끝난 뒤여야 한다 — 트랜잭션이 실패하면 안내도 나가면 안 된다.
    const [dispatchOrder] = dispatcher.dispatchCommon.mock.invocationCallOrder;
    const [transactionOrder] = prisma.$transaction.mock.invocationCallOrder;
    expect(dispatchOrder).toBeDefined();
    expect(transactionOrder).toBeDefined();
    expect(dispatchOrder).toBeGreaterThan(transactionOrder as number);
  });

  it("탈퇴 트랜잭션이 실패하면 LINE 안내를 보내지 않는다", async () => {
    const { prisma, dispatcher, service } = makeMocks(
      { email: "nagisa@example.com" },
      { id: "wd-1" },
    );
    prisma.$transaction.mockRejectedValue(new Error("DB 오류"));

    await expect(service.withdraw("inf-1", actor)).rejects.toThrow("DB 오류");

    expect(dispatcher.dispatchCommon).not.toHaveBeenCalled();
  });

  // 어드민이 일방적으로 탈퇴시킬 수 없어야 한다. 본인 신청이 전제이며,
  // 그래야 사유·SNS 스냅샷을 담을 기록이 반드시 존재한다.
  it("대기 중인 신청이 없으면 409 — 아무것도 바꾸지 않는다", async () => {
    const { prisma, service } = makeMocks({ email: "nagisa@example.com" });

    await expect(service.withdraw("inf-1", actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.influencer.update).not.toHaveBeenCalled();
  });
});

describe("탈퇴 신청 반려", () => {
  function makeRejectMocks(pending: unknown) {
    const prisma = {
      influencerWithdrawal: {
        findFirst: jest.fn().mockResolvedValue(pending),
        update: jest.fn().mockResolvedValue({
          id: "wd-1",
          reason: "SNS_INACTIVE",
          reasonDetail: "",
          decision: "REJECTED",
          requestedAt: new Date("2026-11-01T00:00:00Z"),
          decidedAt: new Date("2026-11-02T00:00:00Z"),
          decidedBy: { name: "운영자" },
          rejectReason: "미정산 보수가 남아 있습니다",
        }),
      },
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const dispatcher = { dispatchCommon: jest.fn().mockResolvedValue(undefined) };
    const service = new InfluencersService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      dispatcher as unknown as LineDispatcherService,
    );
    return { prisma, audit, dispatcher, service };
  }

  const pendingRow = {
    id: "wd-1",
    influencer: { name: "나기사", lineUserId: "U1" },
  };

  it("REJECTED 로 닫고 사유를 LINE 으로 안내한다", async () => {
    const { prisma, dispatcher, service } = makeRejectMocks(pendingRow);

    const result = await service.rejectWithdrawal(
      "inf-1",
      actor,
      "미정산 보수가 남아 있습니다",
    );

    expect(prisma.influencerWithdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decision: "REJECTED",
          decidedById: "admin-1",
          rejectReason: "미정산 보수가 남아 있습니다",
        }),
      }),
    );
    expect(dispatcher.dispatchCommon).toHaveBeenCalledWith(
      "COMMON_WITHDRAWAL_REJECTED",
      expect.objectContaining({
        withdrawal: { rejectReason: "미정산 보수가 남아 있습니다" },
      }),
    );
    expect(result.decision).toBe("REJECTED");
  });

  it("반려 사유 본문은 감사 로그에 남기지 않는다", async () => {
    const { audit, service } = makeRejectMocks(pendingRow);

    await service.rejectWithdrawal("inf-1", actor, "미정산 보수가 남아 있습니다");

    expect(JSON.stringify(audit.record.mock.calls[0][0])).not.toContain(
      "미정산 보수가 남아 있습니다",
    );
  });

  it("대기 건이 없으면 404", async () => {
    const { service } = makeRejectMocks(null);
    await expect(
      service.rejectWithdrawal("inf-1", actor, "사유"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("탈퇴 권한 (컨트롤러)", () => {
  function makeController() {
    const svc = {
      withdraw: jest.fn().mockResolvedValue(undefined),
      rejectWithdrawal: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new InfluencersController(
      svc as unknown as InfluencersService,
    );
    return { svc, controller };
  }

  const userWithRole = (role: string) =>
    ({ id: "admin-1", role } as unknown as AuthenticatedUser);

  it("OWNER 는 탈퇴를 실행할 수 있다", async () => {
    const { svc, controller } = makeController();
    await controller.withdraw({ user: userWithRole("OWNER") }, "inf-1");
    expect(svc.withdraw).toHaveBeenCalledWith("inf-1", expect.anything());
  });

  it.each(["ADMIN", "GUEST"])(
    "%s 는 거부되고 서비스가 호출되지 않는다 — 화면 우회 방어",
    async (role) => {
      const { svc, controller } = makeController();
      await expect(
        controller.withdraw({ user: userWithRole(role) }, "inf-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(svc.withdraw).not.toHaveBeenCalled();
    },
  );

  it.each(["ADMIN", "GUEST"])("%s 는 반려도 할 수 없다", async (role) => {
    const { svc, controller } = makeController();
    await expect(
      controller.rejectWithdrawal({ user: userWithRole(role) }, "inf-1", {
        rejectReason: "사유",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.rejectWithdrawal).not.toHaveBeenCalled();
  });
});
