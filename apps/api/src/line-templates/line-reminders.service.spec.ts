import { LineRemindersService } from "./line-reminders.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { LineDispatcherService } from "./line-dispatcher.service";

const DAY_MS = 24 * 60 * 60 * 1000;

// 테스트 환경은 기본적으로 LINE 발송이 막혀 runDaily 가 조기 반환한다.
// 대상 선정 로직을 검증하려면 명시적으로 열어야 한다(디스패처는 mock).
beforeAll(() => {
  process.env.LINE_PUSH_ENABLED = "true";
});
afterAll(() => {
  delete process.env.LINE_PUSH_ENABLED;
});

/**
 * findMany 를 미니 Prisma 필터로 흉내내어 서비스의 where 절이 실제로
 * 적용되도록 한다. 테스트에서 쓰는 where 형태(equals / {in} / {not:null} /
 * campaign.category)만 지원한다.
 */
function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (key === "campaign") {
      const category = (cond as { category?: string }).category;
      if (category && (row.campaign as { category?: string }).category !== category) return false;
      continue;
    }
    if (key === "posts") continue; // relation 필터는 흉내내지 않음(대상 픽스처는 SIMPLE_REVIEW 뿐)
    const value = row[key];
    if (cond && typeof cond === "object") {
      const c = cond as { in?: unknown[]; not?: unknown };
      if ("in" in c && !c.in!.includes(value)) return false;
      if ("not" in c && c.not === null && (value === null || value === undefined)) return false;
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

function makePrismaMock(rows: Array<Record<string, unknown>>): PrismaService {
  return {
    campaignApplication: {
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(rows.filter((row) => matchesWhere(row, where))),
      ),
    },
    submissionRejection: { findFirst: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;
}

const campaign = {
  id: "c1",
  title: "단순리뷰 캠페인",
  category: "SIMPLE_REVIEW",
  postingPeriodDays: 14,
};

/** 마감 3일 전이 되도록 기준 시각을 now-11일로 잡는다 (기준 + 14일 = now + 3일). */
function anchorForThreeDaysLeft(now: number): Date {
  return new Date(now - (campaign.postingPeriodDays - 3) * DAY_MS);
}

describe("LineRemindersService - SIMPLE_REVIEW 6-R", () => {
  it("승인만 되고 수령 확인 전(receivedAt null) 응모에는 리뷰 마감 리마인더를 보내지 않는다", async () => {
    const now = Date.now();
    const approvedNotReceived = {
      id: "appr",
      status: "APPROVED",
      reviewedAt: anchorForThreeDaysLeft(now), // 승인 시각은 3일 전 마감이 되게 잡음
      receivedAt: null, // 아직 수령 확인 안 함(운송장 미입력/미발송)
      submissionReviewStatus: "PENDING",
      submissionReviewedAt: null,
      posts: [],
      campaign,
    };
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([approvedNotReceived]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).not.toHaveBeenCalledWith(
      "SIMPLE_REVIEW_DEADLINE_REMINDER",
      expect.anything(),
    );
  });

  it("수령 확인(receivedAt) 기준으로 마감 3일 전이면 리마인더를 보낸다", async () => {
    const now = Date.now();
    const received = {
      id: "recv",
      status: "DELIVERED",
      reviewedAt: new Date(now - 20 * DAY_MS), // 승인은 훨씬 전이어도 무관해야 함
      receivedAt: anchorForThreeDaysLeft(now), // 수령 확인이 3일 전 마감 기준
      submissionReviewStatus: "PENDING",
      submissionReviewedAt: null,
      posts: [],
      campaign,
    };
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([received]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).toHaveBeenCalledWith(
      "SIMPLE_REVIEW_DEADLINE_REMINDER",
      expect.objectContaining({
        application: expect.objectContaining({ id: "recv" }),
        extra: { remainingDays: 3 },
      }),
    );
  });
});
