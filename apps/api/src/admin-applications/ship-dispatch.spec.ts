import { AdminApplicationsService } from "./admin-applications.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuditService, AuditActor } from "../audit/audit.service";
import type { LineDispatcherService } from "../line-templates/line-dispatcher.service";
import type { LineMessagingService } from "../influencer-auth/line-messaging.service";
import type { R2Service } from "../r2/r2.service";
import type { UploadsService } from "../uploads/uploads.service";

const actor: AuditActor = { id: "admin-1", name: "운영자" };

const SHIPPED_AT = new Date("2026-07-10T01:00:00.000Z");
const DELIVERED_AT = new Date("2026-07-12T01:00:00.000Z");

/**
 * 발송·배송 처리 전 스냅샷 — shippedAt/deliveredAt 이 아직 비어 있다.
 * 이걸 그대로 디스패치에 넘기면 템플릿의 발송일/배송완료일 변수가 빈 문자열이 된다.
 */
function makeExisting(status: "APPROVED" | "SHIPPED") {
  return {
    id: "application-1",
    campaignId: "campaign-1",
    status,
    trackingCarrier: null,
    trackingNumber: null,
    shippedAt: null,
    deliveredAt: null,
    campaign: { id: "campaign-1", title: "체험단", category: "SNS" },
    influencer: { id: "influencer-1", lineUserId: "U1" },
  };
}

function makeService(existing: ReturnType<typeof makeExisting>, updated: object) {
  const prisma = {
    campaignApplication: {
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(updated),
    },
  };
  const dispatcher = { dispatch: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminApplicationsService(
    prisma as unknown as PrismaService,
    {} as LineMessagingService,
    dispatcher as unknown as LineDispatcherService,
    {} as R2Service,
    audit as unknown as AuditService,
    {} as UploadsService,
  );
  // fetch() 는 응답 조립용이라 이 테스트의 관심사가 아니다.
  jest
    .spyOn(
      service as unknown as { fetch: (id: string) => Promise<unknown> },
      "fetch",
    )
    .mockResolvedValue({});
  return { prisma, dispatcher, service };
}

describe("발송·배송 알림의 디스패치 컨텍스트", () => {
  it("발송 처리는 갱신 결과(shippedAt 포함)를 넘긴다", async () => {
    const updated = { ...makeExisting("APPROVED"), status: "SHIPPED", shippedAt: SHIPPED_AT };
    const { prisma, dispatcher, service } = makeService(makeExisting("APPROVED"), updated);

    await service.ship("application-1", actor, "ヤマト運輸", "");

    expect(prisma.campaignApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.anything() }),
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      "SNS_APPLICATION_SHIPPED_TRACKING_PENDING",
      { application: expect.objectContaining({ shippedAt: SHIPPED_AT }) },
    );
  });

  it("배송 완료 처리는 갱신 결과(deliveredAt 포함)를 넘긴다", async () => {
    const updated = {
      ...makeExisting("SHIPPED"),
      status: "DELIVERED",
      shippedAt: SHIPPED_AT,
      deliveredAt: DELIVERED_AT,
    };
    const { dispatcher, service } = makeService(makeExisting("SHIPPED"), updated);

    await service.deliver("application-1", actor);

    expect(dispatcher.dispatch).toHaveBeenCalledWith("SNS_APPLICATION_DELIVERED", {
      application: expect.objectContaining({ deliveredAt: DELIVERED_AT }),
    });
  });
});
