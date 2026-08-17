import { useEffect, useState } from "react";
import { translate } from "@i18n/admin";
import type { CampaignForm as Values, CampaignResponse } from "@jsure/shared";
import { getStoredLanguage } from "@/lib/i18n";
import { getCampaign } from "./api";
import { EMPTY_CAMPAIGN_FORM } from "./components/CampaignForm";

/** 캠페인 폼 진입 경로. copy 는 기존 캠페인을 원본으로 새 캠페인을 만드는 경우. */
export type CampaignFormSource =
  | { kind: "empty" }
  | { kind: "edit"; id: string }
  | { kind: "copy"; id: string };

export type CampaignFormInitialState =
  | { kind: "loading" }
  /** campaign 은 원본 응답 — 신규 작성이면 null, 복사면 복사 원본. */
  | { kind: "ready"; initial: Values; campaign: CampaignResponse | null }
  | { kind: "error"; message: string };

const TITLE_MAX_LENGTH = 100;

function toFormValues(campaign: CampaignResponse): Values {
  return {
    category: campaign.category,
    title: campaign.title,
    rewardType: campaign.rewardType,
    rewardJpy: campaign.rewardJpy,
    recruitStartDate: campaign.recruitStartDate,
    recruitEndDate: campaign.recruitEndDate,
    postingPeriodDays: campaign.postingPeriodDays,
    orderPeriodDays: campaign.orderPeriodDays,
    recruits: campaign.recruits,
    productSummary: campaign.productSummary,
    productDetailUrls: campaign.productDetailUrls,
    guideline: campaign.guideline,
    referenceMediaUrls: campaign.referenceMediaUrls,
    cautions: campaign.cautions,
    thumbnailUrl: campaign.thumbnailUrl,
    excludedCampaignIds: campaign.excludedCampaignIds,
  };
}

/** 복사 초기값 — 모집기간만 비우고 나머지는 원본을 그대로 쓴다. 제목은 원본과 구분되게 표시. */
function toCopyValues(campaign: CampaignResponse): Values {
  return {
    ...toFormValues(campaign),
    title: `${campaign.title}${translate("domains.campaign.copySuffix", getStoredLanguage())}`.slice(
      0,
      TITLE_MAX_LENGTH,
    ),
    recruitStartDate: "",
    recruitEndDate: "",
  };
}

/**
 * 캠페인 폼의 초기값 로딩. 신규(빈 폼)·수정·복사가 같은 로딩/에러 처리를 공유한다.
 * reloadKey 를 바꾸면 다시 불러온다.
 */
export function useCampaignFormInitial(
  source: CampaignFormSource,
  reloadKey = 0,
): CampaignFormInitialState {
  const [state, setState] = useState<CampaignFormInitialState>({
    kind: "loading",
  });
  const sourceKind = source.kind;
  const sourceId = source.kind === "empty" ? null : source.id;

  useEffect(() => {
    if (sourceKind === "empty") {
      setState({
        kind: "ready",
        initial: EMPTY_CAMPAIGN_FORM,
        campaign: null,
      });
      return;
    }
    if (!sourceId) {
      setState({
        kind: "error",
        message: translate("domains.campaign.errors.invalidPath", getStoredLanguage()),
      });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    getCampaign(sourceId)
      .then((campaign) => {
        if (cancelled) return;
        setState({
          kind: "ready",
          initial:
            sourceKind === "copy"
              ? toCopyValues(campaign)
              : toFormValues(campaign),
          campaign,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : translate("domains.campaign.errors.loadFailed", getStoredLanguage()),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [sourceKind, sourceId, reloadKey]);

  return state;
}
