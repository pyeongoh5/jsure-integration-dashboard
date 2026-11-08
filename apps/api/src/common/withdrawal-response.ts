import type { Prisma } from "@prisma/client";
import type { InfluencerWithdrawal } from "@jsure/shared";

/** 처리 관리자 이름까지 붙인 탈퇴 신청 행. 조회하는 쪽은 이 include 를 맞춰야 한다. */
export type WithdrawalRow = Prisma.InfluencerWithdrawalGetPayload<{
  include: { decidedBy: { select: { name: true } } };
}>;

/** 인플루언서 화면과 어드민 목록이 같은 모양을 보도록 변환은 한 곳에서만 한다. */
export function toWithdrawalResponse(row: WithdrawalRow): InfluencerWithdrawal {
  return {
    id: row.id,
    reason: row.reason,
    reasonDetail: row.reasonDetail,
    decision: row.decision,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedByName: row.decidedBy?.name ?? null,
    rejectReason: row.rejectReason,
  };
}
