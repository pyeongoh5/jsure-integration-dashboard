import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CampaignCategory } from "@jsure/shared";
import { CampaignCard, CategoryTabBar, useCampaignList } from "@/domains/campaign";
import { t } from "@i18n";
import styles from "./Browse.module.css";

export function Browse() {
  const nav = useNavigate();
  const [category, setCategory] = useState<CampaignCategory>("SNS");

  const { data, isLoading, isError } = useCampaignList(category);

  return (
    <div className={styles.browse}>
      <div className={styles.brand}>
        <div className={styles.brandTitle}>J-SURE</div>
        <div className={styles.brandSubtitle}>influencer</div>
      </div>
      <CategoryTabBar value={category} onChange={setCategory} /> {/* new */}
      <div className={styles.grid}>
        {isLoading && (
          <>
            <div className={styles.skel} />
            <div className={styles.skel} />
            <div className={styles.skel} />
            <div className={styles.skel} />
          </>
        )}
        {!isLoading && isError && <div className={styles.empty}>{t("pages.browse.loadError")}</div>}
        {!isLoading && !isError && data && data.length === 0 && (
          <div className={styles.empty}>{t("pages.browse.empty")}</div>
        )}
        {!isLoading &&
          !isError &&
          data?.map((card) => (
            <CampaignCard key={card.id} card={card} onSelect={() => nav(`/campaigns/${card.id}`)} />
          ))}
      </div>
    </div>
  );
}
