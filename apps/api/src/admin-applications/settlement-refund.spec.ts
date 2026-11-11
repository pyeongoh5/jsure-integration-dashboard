import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AdminApplicationsService } from "./admin-applications.service";

type SettlementRow = {
  status: "PENDING" | "COMPLETED";
  rewardAmountJpy: number;
  productRefundJpy: number;
  applicationId: string;
  application: {
    campaignId: string;
    campaign: { category: "SNS" | "FAKE_PURCHASE" | "SIMPLE_REVIEW" };
  };
};

const actor = { id: "admin-1", email: "admin@example.com", name: "관리자" };

function makeService(settlement: SettlementRow | null) {
  const updates: { where: unknown; data: Record<string, number> }[] = [];
  const audits: unknown[] = [];
  const prisma = {
    settlement: {
      findUnique: async () => settlement,
      update: async (args: { where: unknown; data: Record<string, number> }) => {
        updates.push(args);
        return args.data;
      },
    },
  };
  const audit = {
    record: async (entry: unknown) => {
      audits.push(entry);
    },
  };
  const service = new AdminApplicationsService(
    prisma as never,
    null as never,
    null as never,
    null as never,
    audit as never,
    null as never,
  );
  return { service, updates, audits };
}

const pendingFakePurchase: SettlementRow = {
  status: "PENDING",
  rewardAmountJpy: 5000,
  productRefundJpy: 3000,
  applicationId: "app-1",
  application: {
    campaignId: "camp-1",
    campaign: { category: "FAKE_PURCHASE" },
  },
};

describe("updateSettlementRefund", () => {
  it("환급액을 바꾸면 합계도 보수 + 환급액으로 다시 계산한다", async () => {
    const { service, updates, audits } = makeService(pendingFakePurchase);
    const result = await service.updateSettlementRefund(actor, "settle-1", 4200);
    expect(result).toEqual({ productRefundJpy: 4200, amountJpy: 9200 });
    expect(updates).toHaveLength(1);
    expect(updates[0]!.data).toEqual({
      productRefundJpy: 4200,
      amountJpy: 9200,
    });
    expect(audits).toHaveLength(1);
  });

  it("정산 건이 없으면 404", async () => {
    const { service } = makeService(null);
    await expect(
      service.updateSettlementRefund(actor, "missing", 1000),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("완료된 정산은 수정할 수 없다", async () => {
    const { service, updates } = makeService({
      ...pendingFakePurchase,
      status: "COMPLETED",
    });
    await expect(
      service.updateSettlementRefund(actor, "settle-1", 1000),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updates).toHaveLength(0);
  });

  it("가구매가 아닌 캠페인의 정산은 수정할 수 없다", async () => {
    const { service, updates } = makeService({
      ...pendingFakePurchase,
      application: { campaignId: "camp-1", campaign: { category: "SNS" } },
    });
    await expect(
      service.updateSettlementRefund(actor, "settle-1", 1000),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updates).toHaveLength(0);
  });
});
