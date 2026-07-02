import type { CampaignCategory, LineTriggerKey, TriggerVariable } from "@jsure/shared";
import type {
  CampaignApplication,
  Campaign,
  Influencer,
  Settlement,
  SubmittedPost,
  SubmittedPostRejection,
} from "@prisma/client";

export type ApplicationWithRels = CampaignApplication & {
  campaign: Pick<Campaign, "id" | "title" | "postingPeriodDays">;
  influencer: Pick<Influencer, "id" | "name" | "lineUserId">;
};

export type DispatchContext = {
  application: ApplicationWithRels;
  post?: SubmittedPost | null;
  rejection?: SubmittedPostRejection | null;
  settlement?: Settlement | null;
  extra?: {
    resubmitDeadlineAt?: Date;
    finalDeadlineAt?: Date;
    remainingDays?: number;
  };
};

export type TriggerVariableWithResolver = TriggerVariable & {
  resolver: (ctx: DispatchContext) => string | null;
};

export type TriggerMetaEntry = {
  category: CampaignCategory;
  requiresSubType: boolean;
  variables: TriggerVariableWithResolver[];
};

function formatJstMonthDay(d: Date): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${month}月${day}日`;
}

function formatJpy(n: number): string {
  return new Intl.NumberFormat("ja-JP").format(n);
}

const COMMON_VARS = {
  influencerName: {
    key: "influencerName",
    label: "Influencer Name",
    description: "Name of the influencer who applied",
    sample: "Hanako Yamada",
    resolver: (ctx) => ctx.application.influencer.name ?? "",
  },
  campaignTitle: {
    key: "campaignTitle",
    label: "Campaign Title",
    description: "Title of the campaign the influencer applied to",
    sample: "Summer Cosmetics PR Campaign",
    resolver: (ctx) => ctx.application.campaign.title,
  },
} satisfies Record<string, TriggerVariableWithResolver>;

const trackingCarrier: TriggerVariableWithResolver = {
  key: "trackingCarrier",
  label: "Shipping Carrier",
  description: "Carrier registered at shipment",
  sample: "Yamato Transport",
  resolver: (ctx) => ctx.application.trackingCarrier ?? "",
};

const trackingNumber: TriggerVariableWithResolver = {
  key: "trackingNumber",
  label: "Tracking Number",
  description: "Tracking number provided by the carrier",
  sample: "1234-5678-9012",
  resolver: (ctx) => ctx.application.trackingNumber ?? "",
};

const rejectReason: TriggerVariableWithResolver = {
  key: "rejectReason",
  label: "Reject Reason",
  description: "Latest reject comment from the reviewer",
  sample: "Please add the required hashtag",
  resolver: (ctx) => ctx.rejection?.comment ?? "",
};

const resubmitDeadline: TriggerVariableWithResolver = {
  key: "resubmitDeadline",
  label: "Resubmission Deadline",
  description: "Deadline for resubmitting the post (JST month/day)",
  sample: "7月20日",
  resolver: (ctx) =>
    ctx.extra?.resubmitDeadlineAt ? formatJstMonthDay(ctx.extra.resubmitDeadlineAt) : "",
};

const finalDeadline: TriggerVariableWithResolver = {
  key: "finalDeadline",
  label: "Final Deadline",
  description: "Absolute last deadline shown in the rejection reminder",
  sample: "7月21日",
  resolver: (ctx) =>
    ctx.extra?.finalDeadlineAt ? formatJstMonthDay(ctx.extra.finalDeadlineAt) : "",
};

const remainingDays: TriggerVariableWithResolver = {
  key: "remainingDays",
  label: "Remaining Days",
  description: "Days remaining until the posting deadline",
  sample: "3",
  resolver: (ctx) => (ctx.extra?.remainingDays != null ? String(ctx.extra.remainingDays) : ""),
};

const rewardJpy: TriggerVariableWithResolver = {
  key: "rewardJpy",
  label: "Reward Amount (JPY)",
  description: "Settlement amount in JPY with thousands separator",
  sample: "15,000",
  resolver: (ctx) => (ctx.settlement ? formatJpy(ctx.settlement.amountJpy) : ""),
};

export const TRIGGER_META: Record<LineTriggerKey, TriggerMetaEntry> = {
  SNS_APPLICATION_APPLIED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_APPLICATION_APPROVED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_APPLICATION_REJECTED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_APPLICATION_SHIPPED: {
    category: "SNS",
    requiresSubType: true,
    variables: [
      COMMON_VARS.influencerName,
      COMMON_VARS.campaignTitle,
      trackingCarrier,
      trackingNumber,
    ],
  },
  SNS_APPLICATION_DELIVERED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_APPLICATION_RECEIPT_CONFIRMED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_POST_SUBMITTED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_POST_DEADLINE_REMINDER: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle, remainingDays],
  },
  SNS_POST_APPROVED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_POST_REJECTED: {
    category: "SNS",
    requiresSubType: true,
    variables: [
      COMMON_VARS.influencerName,
      COMMON_VARS.campaignTitle,
      rejectReason,
      resubmitDeadline,
    ],
  },
  SNS_POST_REJECTION_REMINDER: {
    category: "SNS",
    requiresSubType: true,
    variables: [
      COMMON_VARS.influencerName,
      COMMON_VARS.campaignTitle,
      rejectReason,
      finalDeadline,
    ],
  },
  SNS_INSIGHT_SUBMITTED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_INSIGHT_REMINDER: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_SETTLEMENT_COMPLETED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle, rewardJpy],
  },
  SNS_CAMPAIGN_COMPLETED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
};

export function getMeta(triggerKey: LineTriggerKey): TriggerMetaEntry {
  return TRIGGER_META[triggerKey];
}

export function listTriggersForCategory(category: CampaignCategory): LineTriggerKey[] {
  return (Object.keys(TRIGGER_META) as LineTriggerKey[]).filter(
    (k) => TRIGGER_META[k].category === category,
  );
}

export function publicVariables(triggerKey: LineTriggerKey): TriggerVariable[] {
  return TRIGGER_META[triggerKey].variables.map(({ resolver: _resolver, ...rest }) => rest);
}
