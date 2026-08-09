import {
  DEADLINE_REMINDER_CONFIGS,
  LineRemindersService,
  orderDeadlineActionFor,
  reminderTriggerKeyFor,
} from "./line-reminders.service";
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
      const filter = cond as {
        category?: string;
        deletedAt?: unknown;
        orderPeriodDays?: { not?: unknown };
      };
      const target = row.campaign as {
        category?: string;
        deletedAt?: Date | null;
        orderPeriodDays?: number | null;
      };
      if (filter.category && target.category !== filter.category) return false;
      if (filter.deletedAt === null && target.deletedAt != null) return false;
      if (
        filter.orderPeriodDays?.not === null &&
        target.orderPeriodDays == null
      ) {
        return false;
      }
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

function makePrismaMock(
  rows: Array<Record<string, unknown>>,
  update: jest.Mock = jest.fn().mockResolvedValue(undefined),
): PrismaService {
  return {
    campaignApplication: {
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(rows.filter((row) => matchesWhere(row, where))),
      ),
      update,
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

/** 마감까지 남은 일수가 remainingDays 가 되도록 기준 시각을 역산한다. */
function anchorForRemainingDays(now: number, remainingDays: number): Date {
  return new Date(now - (campaign.postingPeriodDays - remainingDays) * DAY_MS);
}

function anchorForThreeDaysLeft(now: number): Date {
  return anchorForRemainingDays(now, 3);
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

  it("삭제된 캠페인의 응모에는 리마인더를 보내지 않는다", async () => {
    const now = Date.now();
    const onDeletedCampaign = {
      id: "deleted",
      status: "DELIVERED",
      reviewedAt: new Date(now - 20 * DAY_MS),
      receivedAt: anchorForThreeDaysLeft(now),
      submissionReviewStatus: "PENDING",
      submissionReviewedAt: null,
      posts: [],
      campaign: { ...campaign, deletedAt: new Date(now - DAY_MS) },
    };
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([onDeletedCampaign]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).not.toHaveBeenCalled();
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

describe("LineRemindersService - 배송완료 후 수령확인 리마인더", () => {
  /** 어제 배송완료됐고 아직 수령확인하지 않은 응모 픽스처. */
  function deliveredYesterday(now: number) {
    return {
      id: "delivered",
      status: "DELIVERED",
      deliveredAt: new Date(now - DAY_MS),
      receivedAt: null,
      submissionReviewStatus: "PENDING",
      submissionReviewedAt: null,
      posts: [],
      campaign,
    };
  }

  it("어제 배송완료된 미수령 응모에 리마인더를 보낸다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([deliveredYesterday(now)]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).toHaveBeenCalledWith(
      "SIMPLE_REVIEW_APPLICATION_DELIVERY_REMINDER",
      expect.objectContaining({
        application: expect.objectContaining({ id: "delivered" }),
      }),
    );
  });

  it("이미 수령확인한 응모에는 보내지 않는다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([
        { ...deliveredYesterday(now), receivedAt: new Date(now - DAY_MS / 2) },
      ]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).not.toHaveBeenCalledWith(
      "SIMPLE_REVIEW_APPLICATION_DELIVERY_REMINDER",
      expect.anything(),
    );
  });

  it("이틀 전 배송완료 건에는 다시 보내지 않는다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([
        { ...deliveredYesterday(now), deliveredAt: new Date(now - 2 * DAY_MS) },
      ]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("삭제된 캠페인의 응모에는 보내지 않는다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([
        {
          ...deliveredYesterday(now),
          campaign: { ...campaign, deletedAt: new Date(now - DAY_MS) },
        },
      ]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("orderDeadlineActionFor", () => {
  it("마감 3일 전과 마감 당일에 리마인더를 보낸다", () => {
    expect(orderDeadlineActionFor(3)).toBe("remind");
    expect(orderDeadlineActionFor(0)).toBe("remind");
  });

  it("마감 다음날에는 취소한다", () => {
    expect(orderDeadlineActionFor(-1)).toBe("cancel");
  });

  it("그 밖의 날에는 아무것도 하지 않는다", () => {
    // -2 는 이미 취소된 다음날 — 재처리하지 않는다.
    for (const remainingDays of [5, 2, 1, -2, -10]) {
      expect(orderDeadlineActionFor(remainingDays)).toBe("none");
    }
  });
});

describe("LineRemindersService - 가구매 주문 마감", () => {
  const fakePurchaseCampaign = {
    id: "c2",
    title: "가구매 캠페인",
    category: "FAKE_PURCHASE",
    postingPeriodDays: 14,
    orderPeriodDays: 5,
  };

  /** 주문 마감까지 남은 일수가 remainingDays 가 되도록 승인 시각을 역산한다. */
  function awaitingOrder(now: number, remainingDays: number) {
    return {
      id: "order",
      status: "APPROVED",
      reviewedAt: new Date(
        now - (fakePurchaseCampaign.orderPeriodDays - remainingDays) * DAY_MS,
      ),
      receivedAt: null,
      submissionReviewStatus: "PENDING",
      submissionReviewedAt: null,
      posts: [],
      campaign: fakePurchaseCampaign,
    };
  }

  it("마감 3일 전이면 주문 리마인더를 보낸다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([awaitingOrder(now, 3)]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).toHaveBeenCalledWith(
      "FAKE_PURCHASE_ORDER_DEADLINE_REMINDER",
      expect.objectContaining({ extra: { remainingDays: 3 } }),
    );
  });

  it("마감 다음날이면 응모를 취소하고 안내를 보낸다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const update = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([awaitingOrder(now, -1)], update),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(update).toHaveBeenCalledWith({
      where: { id: "order" },
      data: { status: "CANCELLED" },
    });
    expect(dispatch).toHaveBeenCalledWith(
      "FAKE_PURCHASE_ORDER_EXPIRED",
      expect.objectContaining({
        application: expect.objectContaining({ id: "order" }),
      }),
    );
  });

  it("이미 주문한 응모는 대상이 아니다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const update = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock(
        [{ ...awaitingOrder(now, -1), status: "ORDER_SUBMITTED" }],
        update,
      ),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(update).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalledWith(
      "FAKE_PURCHASE_ORDER_EXPIRED",
      expect.anything(),
    );
  });

  it("주문 마감이 없는 캠페인은 대상이 아니다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const update = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock(
        [
          {
            ...awaitingOrder(now, -1),
            campaign: { ...fakePurchaseCampaign, orderPeriodDays: null },
          },
        ],
        update,
      ),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(update).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("reminderTriggerKeyFor", () => {
  const config = DEADLINE_REMINDER_CONFIGS.find(
    (entry) => entry.category === "SIMPLE_REVIEW",
  )!;

  it("마감 다음날(-1)은 독촉 트리거를 고른다", () => {
    expect(reminderTriggerKeyFor(-1, config)).toBe("SIMPLE_REVIEW_OVERDUE_REMINDER");
  });

  it("마감 3일 전·1일 전은 마감 리마인더 트리거를 고른다", () => {
    expect(reminderTriggerKeyFor(3, config)).toBe("SIMPLE_REVIEW_DEADLINE_REMINDER");
    expect(reminderTriggerKeyFor(1, config)).toBe("SIMPLE_REVIEW_DEADLINE_REMINDER");
  });

  it("그 밖의 날에는 아무것도 보내지 않는다", () => {
    // 0 = 마감 당일, -2 = 독촉 이후(1회만 보내므로 재발송 없음), 5 = 아직 이름.
    expect(reminderTriggerKeyFor(0, config)).toBeNull();
    expect(reminderTriggerKeyFor(-2, config)).toBeNull();
    expect(reminderTriggerKeyFor(5, config)).toBeNull();
  });

  it("설정은 카테고리마다 서로 다른 트리거 키를 갖는다", () => {
    const overdueKeys = DEADLINE_REMINDER_CONFIGS.map((entry) => entry.overdueTriggerKey);
    expect(new Set(overdueKeys).size).toBe(DEADLINE_REMINDER_CONFIGS.length);
  });
});

describe("LineRemindersService - 마감 경과 독촉", () => {
  /** 마감 다음날인 미제출 응모 픽스처. */
  function overdueApplication(now: number) {
    return {
      id: "overdue",
      status: "DELIVERED",
      reviewedAt: new Date(now - 20 * DAY_MS),
      receivedAt: anchorForRemainingDays(now, -1),
      submissionReviewStatus: "PENDING",
      submissionReviewedAt: null,
      posts: [],
      campaign,
    };
  }

  it("마감 다음날 미제출 응모에 독촉 트리거를 보낸다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([overdueApplication(now)]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).toHaveBeenCalledWith(
      "SIMPLE_REVIEW_OVERDUE_REMINDER",
      expect.objectContaining({
        application: expect.objectContaining({ id: "overdue" }),
      }),
    );
  });

  it("이미 제출한 응모에는 독촉을 보내지 않는다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([{ ...overdueApplication(now), posts: [{ id: "p1" }] }]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("마감 이틀 뒤에는 독촉을 다시 보내지 않는다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([
        { ...overdueApplication(now), receivedAt: anchorForRemainingDays(now, -2) },
      ]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("LineRemindersService - 반려 재제출 리마인더", () => {
  /** 반려된 지 elapsedDays 일 지난 단순리뷰 응모. */
  function rejected(now: number, elapsedDays: number) {
    return {
      id: "rejected",
      status: "REVIEW_SUBMITTED",
      reviewedAt: new Date(now - 20 * DAY_MS),
      receivedAt: null,
      submissionReviewStatus: "REJECTED",
      submissionReviewedAt: new Date(now - elapsedDays * DAY_MS),
      posts: [],
      campaign,
    };
  }

  function makeService(rows: Array<Record<string, unknown>>, dispatch: jest.Mock) {
    const prisma = makePrismaMock(rows) as unknown as {
      submissionRejection: { findFirst: jest.Mock };
    };
    // 반려 이력이 있어야 발송 대상이 된다.
    prisma.submissionRejection.findFirst = jest
      .fn()
      .mockResolvedValue({ comment: "다시 올려주세요" });
    return new LineRemindersService(
      prisma as unknown as PrismaService,
      { dispatch } as unknown as LineDispatcherService,
    );
  }

  it("반려 3일 후에 재제출 리마인더를 보낸다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);

    await makeService([rejected(now, 3)], dispatch).runNow();

    expect(dispatch).toHaveBeenCalledWith(
      "SIMPLE_REVIEW_REJECTION_REMINDER",
      expect.objectContaining({
        application: expect.objectContaining({ id: "rejected" }),
      }),
    );
  });

  it("반려 다음날에는 보내지 않는다", async () => {
    const now = Date.now();
    const dispatch = jest.fn().mockResolvedValue(undefined);

    await makeService([rejected(now, 1)], dispatch).runNow();

    expect(dispatch).not.toHaveBeenCalled();
  });
});
