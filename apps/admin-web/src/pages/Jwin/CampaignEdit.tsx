import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui";
import { SegmentedTabs } from "@/components/composites/SegmentedTabs";
import {
  useJwinCampaignForm,
  useJwinPrizes,
  useJwinPostTemplates,
  useJwinStatusTransition,
  activationChecklist,
  postTemplateCoverage,
  BasicTab,
  ConnectTab,
  PrizeTab,
  PostTemplateTab,
  ResultTab,
  StatusTransition,
} from "@/components/JwinCampaignForm";
import type { AdminCampaignDetail } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./Jwin.module.css";

type TabKey = "basic" | "connect" | "prize" | "template" | "result";

const EDIT_TAB_KEYS: TabKey[] = ["basic", "connect", "prize", "template", "result"];
const NEW_TAB_KEYS: TabKey[] = ["basic"];

/**
 * S2 캠페인 생성·편집 (겸용). id 없으면 생성, 있으면 편집.
 * 경품·소재는 캠페인 id 가 있어야 붙일 수 있으므로 생성 모드에서는 기본 탭만 연다.
 * 페이지는 조립만 한다 — 데이터는 각 훅이, 판정은 순수 함수가 맡는다.
 */
export function JwinCampaignEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const form = useJwinCampaignForm(id);
  const [tab, setTab] = useState<TabKey>("basic");
  const [saved, setSaved] = useState(false);

  const tabs = useMemo(() => {
    const keys = form.mode === "edit" ? EDIT_TAB_KEYS : NEW_TAB_KEYS;
    return keys.map((key) => ({ key, label: t(`jwin.campaign.tabs.${key}` as const) }));
  }, [form.mode, t]);

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
            <i className="fa-solid fa-arrow-left" aria-hidden="true" /> {t("jwin.campaign.backToList")}
          </button>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              {form.mode === "new"
                ? t("jwin.campaign.create")
                : (form.detail?.brandName ?? t("jwin.campaign.editTitle"))}
            </h1>
          </div>
        </div>
        <div className={styles.saveRow}>
          {saved && <span className={styles.saved}>{t("jwin.common.saved")}</span>}
          {form.saveError && <span className={styles.saveError}>{form.saveError}</span>}
          {/* detail 이 있는 상태에서의 loadError 는 백그라운드 재조회 실패이므로
              전체화면 대신 여기서 인라인으로 보여준다 (실패를 조용히 삼키지 않기 위함) */}
          {form.loadError && form.detail && (
            <span className={styles.saveError}>{form.loadError}</span>
          )}
          <Button variant="primary" size="md" onClick={handleSave} loading={form.saving}>
            {form.mode === "new" ? t("jwin.account.create") : t("jwin.common.save")}
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
            accountsError={form.accountsError}
          />
        )}
        {form.detail && form.mode === "edit" && (
          <CampaignEditBody
            campaignId={form.detail.id}
            detail={form.detail}
            tab={tab}
            onDetailChanged={form.reload}
          />
        )}
      </div>
    </div>
  );
}

/**
 * 경품·소재를 함께 읽는 편집 전용 본문.
 * 상태 전환 체크리스트가 경품·소재·커버리지를 모두 봐야 해서 한 곳에서 훅을 부른다.
 */
function CampaignEditBody({
  campaignId,
  detail,
  tab,
  onDetailChanged,
}: {
  campaignId: string;
  detail: AdminCampaignDetail;
  tab: TabKey;
  onDetailChanged: () => void;
}) {
  const prizes = useJwinPrizes(campaignId);
  const postTemplates = useJwinPostTemplates(campaignId);
  const transition = useJwinStatusTransition(campaignId, onDetailChanged);

  const checks = useMemo(
    () =>
      activationChecklist({
        detail,
        prizes: prizes.prizes,
        coverage: postTemplateCoverage(detail, postTemplates.templates),
      }),
    [detail, prizes.prizes, postTemplates.templates],
  );

  const hasCodePrize = prizes.prizes.some((prize) => prize.type === "CODE");

  return (
    <>
      <div className={styles.statusRow}>
        <StatusTransition
          detail={detail}
          checks={checks}
          changing={transition.changing}
          checksStale={prizes.loading || postTemplates.loading}
          error={transition.error}
          onChange={transition.change}
        />
      </div>

      {tab === "prize" && (
        <PrizeTab
          prizes={prizes.prizes}
          loading={prizes.loading}
          loadError={prizes.loadError}
          onAdd={prizes.add}
          onEdit={prizes.edit}
          onAppendCodes={prizes.appendCodes}
        />
      )}

      {tab === "template" && (
        <PostTemplateTab
          detail={detail}
          templates={postTemplates.templates}
          loading={postTemplates.loading}
          loadError={postTemplates.loadError}
          onAdd={postTemplates.add}
          onDelete={postTemplates.remove}
        />
      )}

      {tab === "result" && (
        <ResultTab detail={detail} hasCodePrize={hasCodePrize} onSaved={onDetailChanged} />
      )}
    </>
  );
}
