import type {
  CampaignAudienceEntry,
  CampaignAudienceSource,
} from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import { useT } from "@/lib/i18n";
import { useCampaignAudience } from "../useCampaignAudience";
import styles from "./CampaignAudienceList.module.css";

type Props = {
  campaignId: string;
  /** 전체 공개 캠페인이면 경고 문구를 띄우지 않는다. */
  isRestricted: boolean;
};

const SOURCE_LABEL: Record<CampaignAudienceSource, AdminTranslationKey> = {
  CAMPAIGN: "domains.campaign.audience.sourceCampaign",
  TAG: "domains.campaign.audience.sourceTag",
  MANUAL: "domains.campaign.audience.sourceManual",
};

/**
 * 저장된 대상자 목록 + 개별 제외. 캠페인 폼의 대상자 피커는 "추가"만 하므로,
 * 여기서 지운 사람은 캠페인을 다시 저장해도 되살아나지 않는다.
 */
export function CampaignAudienceList({ campaignId, isRestricted }: Props) {
  const t = useT();
  const { state, removing, remove } = useCampaignAudience(campaignId);

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
  if (state.audience.length === 0) {
    return (
      <div className={isRestricted ? styles.warning : styles.hint}>
        {isRestricted
          ? t("domains.campaign.audience.listEmptyWarning")
          : t("domains.campaign.audience.listEmpty")}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.count}>
        {t("domains.campaign.audience.listCount", {
          count: state.audience.length,
        })}
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
    <div className={styles.row}>
      <span className={styles.name}>{entry.name}</span>
      <span className={styles.email}>{entry.email}</span>
      <span className={styles.source}>
        {t(SOURCE_LABEL[entry.source])}
        {entry.sourceLabel !== null && ` · ${entry.sourceLabel}`}
      </span>
      <button
        type="button"
        className={styles.remove}
        onClick={onRemove}
        disabled={removing}
      >
        {t("domains.campaign.audience.remove")}
      </button>
    </div>
  );
}
