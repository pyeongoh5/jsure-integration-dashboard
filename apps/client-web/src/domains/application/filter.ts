import type {
  ApplicationStatus,
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

/** 상태 필터 → 실제 status 집합. null 이면 전체. */
export const STATUS_FILTER_GROUPS: Record<
  StatusFilter,
  ApplicationStatus[] | null
> = {
  all: null,
  applied: ["APPLIED"],
  rejected: ["REJECTED"],
  in_progress: ["APPROVED", "SHIPPED", "DELIVERED"],
  ended: ["COMPLETED"],
  cancelled: ["CANCELLED"],
};

export function filterApplications(
  applications: InfluencerApplication[],
  statusFilter: StatusFilter,
  selectedCategories: Set<CampaignCategory>,
): InfluencerApplication[] {
  const statuses = STATUS_FILTER_GROUPS[statusFilter];
  return applications.filter((application) => {
    const statusMatch =
      statuses === null || statuses.includes(application.status);
    const categoryMatch =
      selectedCategories.size === 0 ||
      selectedCategories.has(application.campaignCategory);
    return statusMatch && categoryMatch;
  });
}
