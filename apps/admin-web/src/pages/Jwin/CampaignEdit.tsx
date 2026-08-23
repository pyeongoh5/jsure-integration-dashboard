import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui";
import { JwinStatusBadge } from "@/components/composites";
import { SegmentedTabs } from "@/components/composites/SegmentedTabs";
import { useJwinCampaignForm, BasicTab, ConnectTab } from "@/components/JwinCampaignForm";
import styles from "./Jwin.module.css";

type TabKey = "basic" | "connect";

/**
 * S2 캠페인 생성·편집 (겸용). id 없으면 생성, 있으면 편집.
 * Phase 3: 기본·연동 탭. 경품·소재·결과화면·통계 탭은 Phase 4~5.
 */
export function JwinCampaignEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const form = useJwinCampaignForm(id);
  const [tab, setTab] = useState<TabKey>("basic");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaved(false);
    const result = await form.save();
    if (!result) return;
    if (form.mode === "new") {
      navigate(`/jwin/campaigns/${result.id}`);
    } else {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    }
  };

  if (form.mode === "edit" && form.loading) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>불러오는 중…</div>
      </div>
    );
  }

  if (form.mode === "edit" && form.loadError) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>{form.loadError}</div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] =
    form.mode === "edit"
      ? [
          { key: "basic", label: "기본" },
          { key: "connect", label: "연동" },
        ]
      : [{ key: "basic", label: "기본" }];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <button type="button" className={styles.backLink} onClick={() => navigate("/jwin/campaigns")}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true" /> 캠페인 목록
          </button>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              {form.mode === "new" ? "캠페인 생성" : (form.detail?.brandName ?? "캠페인 편집")}
            </h1>
            {form.detail && <JwinStatusBadge status={form.detail.status} />}
          </div>
        </div>
        <div className={styles.saveRow}>
          {saved && <span className={styles.saved}>저장됨</span>}
          {form.saveError && <span className={styles.saveError}>{form.saveError}</span>}
          <Button variant="primary" size="md" onClick={handleSave} loading={form.saving}>
            {form.mode === "new" ? "생성" : "저장"}
          </Button>
        </div>
      </div>

      <SegmentedTabs items={tabs} value={tab} onChange={setTab} />

      <div className={styles.tabContent}>
        {tab === "basic" && (
          <BasicTab
            values={form.values}
            errors={form.errors}
            setField={form.setField}
            slugLocked={form.detail?.status === "ACTIVE"}
          />
        )}
        {tab === "connect" && form.detail && (
          <ConnectTab
            detail={form.detail}
            accounts={form.accounts}
            onSelectAccount={form.selectAccount}
            selectError={form.selectError}
          />
        )}
      </div>
    </div>
  );
}
