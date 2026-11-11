import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { InfluencerMeWithdrawalService } from "./influencer-me-withdrawal.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuditService } from "../audit/audit.service";

type ApplicationRow = {
  id: string;
  status: string;
  /** 생략 시 PENDING — 아직 검수가 끝나지 않은 진행 중 건. */
  submissionReviewStatus?: "PENDING" | "APPROVED" | "REJECTED";
  campaign: { title: string };
};

function makeService(
  applications: ApplicationRow[],
  latestWithdrawal: unknown = null,
) {
  const campaignApplication = {
    findMany: jest.fn().mockResolvedValue(
      applications.map((application) => ({
        submissionReviewStatus: "PENDING" as const,
        ...application,
      })),
    ),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  const influencerWithdrawal = {
    findFirst: jest.fn().mockResolvedValue(latestWithdrawal),
    create: jest.fn().mockResolvedValue({
      id: "wd-1",
      reason: "SNS_INACTIVE",
      reasonDetail: "쉬어갑니다",
      decision: "PENDING",
      requestedAt: new Date("2026-11-04T00:00:00Z"),
      decidedAt: null,
      decidedBy: null,
      rejectReason: null,
    }),
  };
  const prisma = {
    influencer: { findUnique: jest.fn().mockResolvedValue({ id: "inf-1" }) },
    campaignApplication,
    influencerWithdrawal,
    $transaction: jest.fn((run: (tx: unknown) => Promise<unknown>) =>
      run({ campaignApplication, influencerWithdrawal }),
    ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new InfluencerMeWithdrawalService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { prisma, audit, campaignApplication, influencerWithdrawal, service };
}

const input = { reason: "SNS_INACTIVE", reasonDetail: "쉬어갑니다" } as const;

describe("탈퇴 신청 가능 여부", () => {
  it("진행 중인 응모가 있으면 409 — 캠페인명을 함께 돌려준다", async () => {
    const { service, influencerWithdrawal } = makeService([
      { id: "app-1", status: "SHIPPED", campaign: { title: "가을 신상 체험단" } },
    ]);

    await expect(service.request("inf-1", input)).rejects.toMatchObject({
      response: {
        code: "ONGOING_CAMPAIGN",
        campaignTitles: ["가을 신상 체험단"],
      },
    });
    expect(influencerWithdrawal.create).not.toHaveBeenCalled();
  });

  // 정산 완료로 status 가 COMPLETED 로 넘어가기 전 구간. 인플루언서가 할 일은
  // 끝났으므로 막지 않는다 — 막으면 송금까지 끝난 사람도 탈퇴할 수 없다.
  it("제출물이 승인된 건은 상태가 REVIEW_SUBMITTED 라도 막지 않는다", async () => {
    const { service, influencerWithdrawal } = makeService([
      {
        id: "app-1",
        status: "REVIEW_SUBMITTED",
        submissionReviewStatus: "APPROVED",
        campaign: { title: "정산까지 끝난 캠페인" },
      },
    ]);

    await service.request("inf-1", input);

    expect(influencerWithdrawal.create).toHaveBeenCalled();
  });

  it("제출물 검수가 아직 안 끝났으면 막는다", async () => {
    const { service, influencerWithdrawal } = makeService([
      {
        id: "app-1",
        status: "REVIEW_SUBMITTED",
        submissionReviewStatus: "PENDING",
        campaign: { title: "검수 대기 캠페인" },
      },
    ]);

    await expect(service.request("inf-1", input)).rejects.toMatchObject({
      response: { code: "ONGOING_CAMPAIGN" },
    });
    expect(influencerWithdrawal.create).not.toHaveBeenCalled();
  });

  it("심사 중(APPLIED)인 응모는 막지 않고 같은 트랜잭션에서 취소한다", async () => {
    const { service, campaignApplication, influencerWithdrawal } = makeService([
      { id: "app-1", status: "APPLIED", campaign: { title: "신규 모집" } },
    ]);

    await service.request("inf-1", input);

    expect(campaignApplication.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["app-1"] } },
      data: { status: "CANCELLED" },
    });
    expect(influencerWithdrawal.create).toHaveBeenCalled();
  });

  it("종료·취소만 남았으면 취소할 것도 없이 신청된다", async () => {
    const { service, campaignApplication, influencerWithdrawal } = makeService([]);

    const created = await service.request("inf-1", input);

    expect(campaignApplication.updateMany).not.toHaveBeenCalled();
    expect(influencerWithdrawal.create).toHaveBeenCalled();
    expect(created.decision).toBe("PENDING");
  });

  it("상세 사유를 감사 로그 본문에 남기지 않는다", async () => {
    const { service, audit } = makeService([]);

    await service.request("inf-1", input);

    expect(JSON.stringify(audit.record.mock.calls[0][0])).not.toContain(
      "쉬어갑니다",
    );
  });

  it("대기 중인 신청이 있으면 eligible 이 false 다", async () => {
    const { service } = makeService([], {
      id: "wd-1",
      reason: "SNS_INACTIVE",
      reasonDetail: "",
      decision: "PENDING",
      requestedAt: new Date("2026-11-04T00:00:00Z"),
      decidedAt: null,
      decidedBy: null,
      rejectReason: null,
    });

    const eligibility = await service.getEligibility("inf-1");

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.latest?.decision).toBe("PENDING");
  });

  it("진행 중 응모는 eligible 을 막고, 심사 중 응모는 취소 예정으로만 알린다", async () => {
    const { service } = makeService([
      { id: "app-1", status: "APPLIED", campaign: { title: "신규 모집" } },
    ]);

    const eligibility = await service.getEligibility("inf-1");

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.blockingApplications).toEqual([]);
    expect(eligibility.autoCancelApplications).toEqual([
      { applicationId: "app-1", campaignTitle: "신규 모집" },
    ]);
  });
});

describe("중복 신청", () => {
  it("부분 유니크 인덱스 위반(P2002)은 409 로 바꾼다", async () => {
    const { service, influencerWithdrawal } = makeService([]);
    influencerWithdrawal.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "5.22.0",
      }),
    );

    await expect(service.request("inf-1", input)).rejects.toMatchObject({
      response: { code: "WITHDRAWAL_ALREADY_PENDING" },
    });
  });

  it("그 밖의 DB 오류는 그대로 올린다 — 409 로 덮어쓰지 않는다", async () => {
    const { service, influencerWithdrawal } = makeService([]);
    influencerWithdrawal.create.mockRejectedValue(new Error("연결 끊김"));

    await expect(service.request("inf-1", input)).rejects.not.toBeInstanceOf(
      ConflictException,
    );
  });
});
