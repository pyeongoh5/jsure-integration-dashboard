import { AdminReportsService } from "./admin-reports.service";

type StubApplication = {
  influencerId: string;
  status: string;
  subTypes: string[];
  submissionReviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  posts: {
    subType: string;
    insightLikes: number | null;
    url?: string | null;
    submittedAt?: Date;
  }[];
  settlement: { amountJpy: number } | null;
  options?: { subType: string; option: string }[];
  influencer: {
    id: string;
    name: string;
    snsAccounts: { snsType: string; handle: string; followerCount: number }[];
  };
};

const SUBMITTED_AT = new Date("2026-07-20T02:00:00Z");

function makeService(applications: StubApplication[]) {
  const prisma = {
    campaign: {
      findMany: async () => [
        {
          id: "c1",
          title: "캠페인",
          category: "SNS",
          recruitStartAt: new Date("2026-06-30T15:00:00Z"), // JST 2026-07-01 00:00
          recruitEndAt: new Date("2026-07-31T14:59:59Z"), // JST 2026-07-31 23:59
          applications,
        },
      ],
      findFirst: async () => ({ id: "c1" }),
    },
    campaignApplication: {
      findMany: async () =>
        applications.map((application, index) => ({
          ...application,
          id: `app${index + 1}`,
          options: application.options ?? [],
          posts: application.posts.map((post) => ({
            url: null,
            submittedAt: SUBMITTED_AT,
            ...post,
          })),
        })),
    },
  } as never;
  return new AdminReportsService(prisma);
}

function application(overrides: Partial<StubApplication>): StubApplication {
  return {
    influencerId: "i1",
    status: "APPROVED",
    subTypes: ["INSTAGRAM"],
    submissionReviewStatus: "PENDING",
    posts: [],
    settlement: null,
    influencer: {
      id: "i1",
      name: "인플루언서",
      snsAccounts: [
        { snsType: "INSTAGRAM", handle: "handle", followerCount: 100 },
      ],
    },
    ...overrides,
  };
}

describe("캠페인 리포트 집계", () => {
  it("참여자 수는 승인 이후 응모 수(명)이고 미제출도 포함한다", async () => {
    const service = makeService([
      application({ influencerId: "i1", status: "APPROVED" }),
      application({
        influencerId: "i2",
        status: "REVIEW_SUBMITTED",
        posts: [{ subType: "INSTAGRAM", insightLikes: 10 }],
      }),
      // 승인 전/취소는 참여자가 아니다.
      application({ influencerId: "i3", status: "APPLIED" }),
      application({
        influencerId: "i4",
        status: "CANCELLED",
        posts: [{ subType: "INSTAGRAM", insightLikes: 999 }],
      }),
    ]);

    const { rows } = await service.campaignReports("campaignTitle", "asc");

    expect(rows[0]!.participantCount).toBe(2);
  });

  it("콘텐츠 수는 제출 전체에서 취소 응모와 검수 반려를 뺀다", async () => {
    const service = makeService([
      application({
        influencerId: "i1",
        status: "REVIEW_SUBMITTED",
        posts: [{ subType: "INSTAGRAM", insightLikes: 10 }],
      }),
      application({
        influencerId: "i2",
        status: "REVIEW_SUBMITTED",
        submissionReviewStatus: "REJECTED",
        posts: [{ subType: "INSTAGRAM", insightLikes: 5 }],
      }),
      application({
        influencerId: "i3",
        status: "CANCELLED",
        posts: [{ subType: "INSTAGRAM", insightLikes: 7 }],
      }),
    ]);

    const { rows } = await service.campaignReports("campaignTitle", "asc");

    expect(rows[0]!.postCount).toBe(1);
    expect(rows[0]!.totalLikes).toBe(10);
  });
});

describe("참여자 목록", () => {
  it("미제출 참여자도 행으로 나오고 검수 상태는 비어 있다", async () => {
    const service = makeService([
      application({ influencerId: "i1", status: "APPROVED" }),
    ]);

    const { total, participants } = await service.campaignParticipants(
      "c1",
      0,
      20,
    );

    expect(total).toBe(1);
    expect(participants[0]!.status).toBe("APPROVED");
    expect(participants[0]!.submissionReviewStatus).toBeNull();
    expect(participants[0]!.insight.likes).toBeNull();
  });

  it("제출한 행은 상세 열람용 applicationId·URL·제출일을 내려준다", async () => {
    const service = makeService([
      application({
        influencerId: "i1",
        status: "REVIEW_SUBMITTED",
        posts: [
          {
            subType: "INSTAGRAM",
            insightLikes: 3,
            url: "https://instagram.com/p/abc",
          },
        ],
      }),
    ]);

    const { participants } = await service.campaignParticipants("c1", 0, 20);

    expect(participants[0]).toMatchObject({
      applicationId: "app1",
      postUrl: "https://instagram.com/p/abc",
      submittedAt: SUBMITTED_AT.toISOString(),
    });
  });

  it("제출 전 행은 URL·제출일이 null 이라 상세 진입 대상이 아니다", async () => {
    const service = makeService([
      application({ influencerId: "i1", status: "APPROVED" }),
    ]);

    const { participants } = await service.campaignParticipants("c1", 0, 20);

    expect(participants[0]!.postUrl).toBeNull();
    expect(participants[0]!.submittedAt).toBeNull();
  });

  it("참여 서브타입마다 행이 나온다", async () => {
    const service = makeService([
      application({
        influencerId: "i1",
        status: "REVIEW_SUBMITTED",
        subTypes: ["INSTAGRAM", "TIKTOK"],
        posts: [{ subType: "INSTAGRAM", insightLikes: 3 }],
      }),
    ]);

    const { total, participants } = await service.campaignParticipants(
      "c1",
      0,
      20,
    );

    expect(total).toBe(2);
    expect(participants.map((entry) => entry.subType)).toEqual([
      "INSTAGRAM",
      "TIKTOK",
    ]);
    // 제출한 서브타입만 검수 상태가 붙는다.
    expect(participants[0]!.submissionReviewStatus).toBe("PENDING");
    expect(participants[1]!.submissionReviewStatus).toBeNull();
  });

  it("campaignReports 는 카테고리와 JST 모집기간을 내려준다", async () => {
    const service = makeService([]);
    const { rows } = await service.campaignReports("campaignTitle", "asc");
    expect(rows[0]!.category).toBe("SNS");
    expect(rows[0]!.recruitStartDate).toBe("2026-07-01");
    expect(rows[0]!.recruitEndDate).toBe("2026-07-31");
  });
});
