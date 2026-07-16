import type {
  ApplicationDisplayStage,
  CampaignCategory,
  InfluencerApplication,
} from "@jsure/shared";

export type StatusFilter =
  | "all"
  | "applied"
  | "rejected"
  | "in_progress"
  | "ended"
  | "cancelled";

// 원시 status 는 제출 완료 이후 REVIEW_SUBMITTED 에 머물러 종료 여부를 판정할 수 없다.
// 검토/정산까지 반영된 displayStage 기준으로 필터링한다.
const APPLIED_STAGES: ApplicationDisplayStage[] = ["APPLIED"];
const REJECTED_STAGES: ApplicationDisplayStage[] = ["REJECTED"];
const ENDED_STAGES: ApplicationDisplayStage[] = ["COMPLETED", "SETTLED"];
const CANCELLED_STAGES: ApplicationDisplayStage[] = ["CANCELLED"];

function matchesStatusFilter(
  filter: StatusFilter,
  stage: ApplicationDisplayStage,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "applied":
      return APPLIED_STAGES.includes(stage);
    case "rejected":
      return REJECTED_STAGES.includes(stage);
    case "ended":
      return ENDED_STAGES.includes(stage);
    case "cancelled":
      return CANCELLED_STAGES.includes(stage);
    case "in_progress":
      // 나머지 전부 = 진행 중 (승인~검토 대기까지). 신규 스테이지가 생겨도 누락되지 않게 배제 방식.
      return ![
        ...APPLIED_STAGES,
        ...REJECTED_STAGES,
        ...ENDED_STAGES,
        ...CANCELLED_STAGES,
      ].includes(stage);
  }
}

export function filterApplications(
  applications: InfluencerApplication[],
  statusFilter: StatusFilter,
  selectedCategories: Set<CampaignCategory>,
): InfluencerApplication[] {
  return applications.filter((application) => {
    const statusMatch = matchesStatusFilter(
      statusFilter,
      application.displayStage,
    );
    const categoryMatch =
      selectedCategories.size === 0 ||
      selectedCategories.has(application.campaignCategory);
    return statusMatch && categoryMatch;
  });
}
