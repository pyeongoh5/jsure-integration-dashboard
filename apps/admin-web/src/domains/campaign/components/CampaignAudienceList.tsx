import type {
  CampaignAudienceEntry,
  CampaignAudienceInput,
  CampaignAudienceSource,
} from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import { useT } from "@/lib/i18n";
import { useCampaignAudience } from "../useCampaignAudience";
import styles from "./CampaignAudienceList.module.css";

type Props = {
  /** 신규 작성이면 undefined — 저장된 대상자가 아직 없고 프리뷰만 보여준다. */
  campaignId: string | undefined;
  /** 폼에서 지금 지정 중인 값. 바뀔 때마다 프리뷰를 다시 받는다. */
  input: CampaignAudienceInput;
  /** 전체 공개 캠페인이면 대상자 0명이어도 경고하지 않는다. */
  isRestricted: boolean;
  /**
   * 직접 지정(MANUAL)한 인원을 규칙에서 빼는 콜백. 직접 지정은 그 자체가 규칙이라
   * 여기서 빼는 것이 곧 규칙 수정이다 — 명단에 구멍을 내는 것이 아니다.
   */
  onRemoveManual: (influencerId: string) => void;
};

const SOURCE_LABEL: Record<CampaignAudienceSource, AdminTranslationKey> = {
  CAMPAIGN: "domains.campaign.audience.sourceCampaign",
  TAG: "domains.campaign.audience.sourceTag",
  MANUAL: "domains.campaign.audience.sourceManual",
};

/**
 * 저장하면 최종적으로 대상이 될 인원을 실시간으로 보여준다.
 * 캠페인·태그로 들어온 인원은 여기서 뺄 수 없다 — 위 규칙에서 빼야 한다.
 * 직접 지정 인원만 ✕ 로 뺀다(그게 규칙 자체라서).
 */
export function CampaignAudienceList({
  campaignId,
  input,
  isRestricted,
  onRemoveManual,
}: Props) {
  const t = useT();
  const { state } = useCampaignAudience(campaignId, input);

  if (state.kind === "loading") {
    return <div className={styles.hint}>{t("common.loading")}</div>;
  }
  if (state.kind === "error") {
    return (
      <div className={styles.hint}>
        {t("domains.campaign.audience.listError")}
      </div>
    );
  }

  const savedCount = state.audience.filter((entry) => !entry.pending).length;
  const pendingCount = state.audience.length - savedCount;

  return (
    <div className={styles.root}>
      {state.emptyRuleLabels.length > 0 && (
        <div className={styles.warning}>
          {t("domains.campaign.audience.emptyRules", {
            labels: state.emptyRuleLabels.join(", "),
          })}
        </div>
      )}
      {state.unknownTagLabels.length > 0 && (
        <div className={styles.warning}>
          {t("domains.campaign.audience.unknownTags", {
            labels: state.unknownTagLabels.join(", "),
          })}
        </div>
      )}

      {state.audience.length === 0 ? (
        <div className={isRestricted ? styles.warning : styles.hint}>
          {isRestricted
            ? t("domains.campaign.audience.listEmptyWarning")
            : t("domains.campaign.audience.listEmpty")}
        </div>
      ) : (
        <>
          <div className={styles.count}>
            {t("domains.campaign.audience.listCount", {
              count: state.audience.length,
            })}
            {pendingCount > 0 &&
              ` · ${t("domains.campaign.audience.listPendingCount", {
                count: pendingCount,
              })}`}
          </div>
          <div className={styles.list}>
            {state.audience.map((entry) => (
              <AudienceRow
                key={entry.influencerId}
                entry={entry}
                onRemove={
                  entry.source === "MANUAL"
                    ? () => onRemoveManual(entry.influencerId)
                    : undefined
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AudienceRow({
  entry,
  onRemove,
}: {
  entry: CampaignAudienceEntry;
  /** 직접 지정 인원만 뺄 수 있다. 그 외에는 undefined. */
  onRemove?: () => void;
}) {
  const t = useT();
  return (
    <div className={`${styles.row} ${entry.pending ? styles.rowPending : ""}`}>
      <span className={styles.name}>{entry.name}</span>
      <span className={styles.email}>{entry.email}</span>
      <span className={styles.source}>
        {t(SOURCE_LABEL[entry.source])}
        {entry.sourceLabel !== null && ` · ${entry.sourceLabel}`}
      </span>
      {entry.pending && (
        <span className={styles.pendingBadge}>
          {t("domains.campaign.audience.pendingBadge")}
        </span>
      )}
      {onRemove && (
        <button type="button" className={styles.remove} onClick={onRemove}>
          {t("domains.campaign.audience.remove")}
        </button>
      )}
    </div>
  );
}
