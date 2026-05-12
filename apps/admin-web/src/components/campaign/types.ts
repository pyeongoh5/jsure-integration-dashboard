export type CampaignStatus = "recruit" | "review" | "progress" | "done";

export type Campaign = {
  id: string;
  brand: string;
  name: string;
  description: string;
  status: CampaignStatus;
  thumbIcon: string;
  period: string;
  reward: string;
  applied: number;
  capacity: number;
  dday: number;
};

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  recruit: "모집중",
  review: "검토중",
  progress: "진행중",
  done: "완료",
};
