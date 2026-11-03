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
};

const SOURCE_LABEL: Record<CampaignAudienceSource, AdminTranslationKey> = {
  CAMPAIGN: "domains.campaign.audience.sourceCampaign",
  TAG: "domains.campaign.audience.sourceTag",
  MANUAL: "domains.campaign.audience.sourceManual",
};

/**
 * 저장하면 최종적으로 대상이 될 인원을 실시간으로 보여준다.
 * 이미 저장된 행만 개별 제외할 수 있다 — 아직 추가 전인 행은 위 피커에서 빼면 된다.
 */
export function CampaignAudienceList({ campaignId, input, isRestricted }: Props) {
  const t = useT();
  const { state, removing, remove } = useCampaignAudience(campaignId, input);

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
                removing={removing === entry.influencerId}
                onRemove={() => void remove(entry.influencerId)}
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
  removing,
  onRemove,
}: {
  entry: CampaignAudienceEntry;
  removing: boolean;
  onRemove: () => void;
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
      {entry.pending ? (
        <span className={styles.pendingBadge}>
          {t("domains.campaign.audience.pendingBadge")}
        </span>
      ) : (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          disabled={removing}
        >
          {t("domains.campaign.audience.remove")}
        </button>
      )}
    </div>
  );
}
