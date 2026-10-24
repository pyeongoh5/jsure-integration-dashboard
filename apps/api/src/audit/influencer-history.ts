import {
  ApplicationStatusSchema,
  CampaignSubTypeSchema,
  type AdminActivityLog,
  type InfluencerActivityGroup,
} from "@jsure/shared";
import { toActivityLog, type ActivityLogRow } from "./application-activity";
import {
  influencerActivityEntries,
  type InfluencerActivitySource,
} from "./influencer-activity";

/** 응모 1건 — 그룹 헤더에 쓰는 필드 + 인플루언서 액션 합성에 필요한 타임스탬프. */
export type InfluencerHistoryApplicationRow = InfluencerActivitySource & {
  id: string;
  status: string;
  rejectReason: string | null;
  subTypes: string[];
  campaign: { id: string; title: string };
  /** 응모 검토(승인·반려) 시각과 처리자. 반려 이벤트 합성에만 쓴다. */
  reviewedAt: Date | null;
  reviewedBy: { id: string; name: string | null } | null;
};

/** 여러 응모를 한 번에 읽으므로 어느 응모의 로그인지 알아야 한다. */
export type InfluencerHistoryLogRow = ActivityLogRow & {
  applicationId: string | null;
};

function newestEventAt(group: InfluencerActivityGroup): string {
  return group.events[0]?.createdAt ?? "";
}

/**
 * 감사 로그 도입(20260810010000_admin_activity_log) 이전에 반려된 응모는
 * APPLICATION_REJECT 로그가 없어 히스토리에서 반려 사실 자체가 사라진다.
 * reviewedAt/reviewedById 컬럼에 시각과 처리자가 남아 있으므로 여기서 되살린다.
 *
 * 로그가 있는 건은 그쪽이 원본이므로 합성하지 않는다 — 같은 반려가 두 줄이 된다.
 */
function syntheticRejectEntry(
  application: InfluencerHistoryApplicationRow,
  logs: AdminActivityLog[],
): AdminActivityLog | null {
  if (application.status !== "REJECTED") return null;
  if (!application.reviewedAt) return null;
  if (logs.some((log) => log.action === "APPLICATION_REJECT")) return null;
  return {
    id: "synthetic-application-reject",
    action: "APPLICATION_REJECT",
    // 처리자를 모르면(옛 데이터) 시스템 처리로 보이게 둔다.
    origin: application.reviewedBy ? "ADMIN" : "SYSTEM",
    actor: application.reviewedBy,
    metadata: application.rejectReason
      ? { reason: application.rejectReason }
      : null,
    createdAt: application.reviewedAt.toISOString(),
  };
}

/**
 * 인플루언서의 응모들을 "응모 1건 = 그룹, 그 안의 이벤트 = 행" 모양으로 조립한다.
 * 그룹 안 이벤트와 그룹 자체 모두 최신순이다.
 *
 * applicationId 가 없는 로그(인플루언서 단위 메모/대상외 지정 등)는 캠페인 활동이
 * 아니므로 버린다 — 메모는 메모 탭이 원본을 직접 보여준다.
 */
export function influencerHistoryGroups(
  applications: InfluencerHistoryApplicationRow[],
  logs: InfluencerHistoryLogRow[],
): InfluencerActivityGroup[] {
  const logsByApplication = new Map<string, InfluencerHistoryLogRow[]>();
  for (const log of logs) {
    if (!log.applicationId) continue;
    const existing = logsByApplication.get(log.applicationId);
    if (existing) {
      existing.push(log);
      continue;
    }
    logsByApplication.set(log.applicationId, [log]);
  }

  const groups = applications.map((application) => {
    const logs = (logsByApplication.get(application.id) ?? []).map(
      toActivityLog,
    );
    const synthesized = syntheticRejectEntry(application, logs);
    return {
      applicationId: application.id,
      campaignId: application.campaign.id,
      campaignTitle: application.campaign.title,
      subTypes: application.subTypes.map((subType) =>
        CampaignSubTypeSchema.parse(subType),
      ),
      status: ApplicationStatusSchema.parse(application.status),
      rejectReason: application.rejectReason,
      events: [
        ...logs,
        ...influencerActivityEntries(application),
        ...(synthesized ? [synthesized] : []),
      ].sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1)),
    };
  });

  return groups.sort((left, right) =>
    newestEventAt(left) < newestEventAt(right) ? 1 : -1,
  );
}
