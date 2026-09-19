import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui";
import { BasicTab, useJwinCampaignForm } from "@/components/JwinCampaignForm";
import { JwinBrandCampaignTable, JwinBrandCampaignAddDialog } from "@/components/JwinCampaigns";
import {
  activateCampaign,
  jwinErrorMessage,
  type AdminCampaignActivateResponse,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./Jwin.module.css";

/**
 * 시즌 캠페인 생성·상세 (겸용). id 없으면 생성, 있으면 상세.
 * 상세에서는 기본 정보 아래에 참여 브랜드 표를 함께 관리한다 —
 * 참여를 누르면 그 참여의 편집 화면(/jwin/brand-campaigns/:id)으로 간다.
 */
export function JwinCampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const form = useJwinCampaignForm(id);
  const [saved, setSaved] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activateBlockers, setActivateBlockers] = useState<
    AdminCampaignActivateResponse["blockers"]
  >([]);

  const brands = form.detail?.brands ?? [];
  const setupCount = brands.filter((brand) => brand.status === "SETUP").length;

  const handleActivate = async () => {
    if (!form.detail) return;
    setActivating(true);
    setActivateError(null);
    setActivateBlockers([]);
    try {
      const result = await activateCampaign(form.detail.id);
      if (result.blockers.length > 0) {
        setActivateBlockers(result.blockers);
        return;
      }
      form.reload();
    } catch (caught: unknown) {
      setActivateError(jwinErrorMessage(caught, t("jwin.campaign.startFailed")));
    } finally {
      setActivating(false);
    }
  };
  // 참여가 하나라도 시작됐으면 slug 를 잠근다 — 게시된 링크가 깨진다.
  const slugLocked = brands.some((brand) => brand.status !== "SETUP");

  const handleSave = async () => {
    setSaved(false);
    const result = await form.save();
    if (!result) return;
    if (form.mode === "new") {
      navigate(`/jwin/campaigns/${result.id}`);
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  // detail 이 이미 있으면 백그라운드 재조회일 뿐이므로 전체 화면 로딩/에러로 덮지 않는다.
  if (form.mode === "edit" && form.loading && !form.detail) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>{t("jwin.common.loading")}</div>
      </div>
    );
  }

  if (form.mode === "edit" && form.loadError && !form.detail) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>{form.loadError}</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <button
            type="button"
            className={styles.backLink}
            onClick={() => navigate("/jwin/campaigns")}
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />{" "}
            {t("jwin.campaign.backToList")}
          </button>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              {form.mode === "new"
                ? t("jwin.campaign.create")
                : (form.detail?.name ?? t("jwin.campaign.editTitle"))}
            </h1>
          </div>
        </div>
        <div className={styles.saveRow}>
          {saved && <span className={styles.saved}>{t("jwin.common.saved")}</span>}
          {form.saveError && <span className={styles.saveError}>{form.saveError}</span>}
          {form.loadError && form.detail && (
            <span className={styles.saveError}>{form.loadError}</span>
          )}
          <Button variant="primary" size="md" onClick={handleSave} loading={form.saving}>
            {form.mode === "new" ? t("jwin.account.create") : t("jwin.common.save")}
          </Button>
        </div>
      </div>

      <div className={styles.tabContent}>
        <div className={styles.tabCard}>
          <BasicTab
            values={form.values}
            errors={form.errors}
            setField={form.setField}
            slugLocked={slugLocked}
          />
        </div>

        {form.mode === "edit" && form.detail && (
          <div className={styles.tabCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{t("jwin.campaign.brands.title")}</h2>
              <div className={styles.sectionActions}>
                {setupCount > 0 && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => void handleActivate()}
                    loading={activating}
                  >
                    {t("jwin.campaign.start", { count: setupCount })}
                  </Button>
                )}
                <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
                  {t("jwin.campaign.brands.add")}
                </Button>
              </div>
            </div>

            {activateError && <div className={styles.saveError}>{activateError}</div>}
            {activateBlockers.length > 0 && (
              <div className={styles.activateBlockers}>
                <strong>{t("jwin.campaign.startBlockedTitle")}</strong>
                <ul>
                  {activateBlockers.map((blocker) => (
                    <li key={blocker.brandCampaignId}>
                      <strong>{blocker.brandName}</strong>: {blocker.reasons.join(" / ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <JwinBrandCampaignTable
              rows={brands}
              onRowClick={(brandCampaignId) =>
                navigate(`/jwin/brand-campaigns/${brandCampaignId}`)
              }
              onChanged={form.reload}
            />

            <JwinBrandCampaignAddDialog
              open={addOpen}
              campaignId={form.detail.id}
              participatingBrandIds={brands.map((brand) => brand.brandAccountId)}
              onClose={() => setAddOpen(false)}
              onAdded={() => {
                setAddOpen(false);
                form.reload();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
