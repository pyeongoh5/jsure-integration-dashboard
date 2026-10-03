import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { JwinAccountStatusBadge } from "@/components/composites";
import { Button } from "@/components/ui";
import { SegmentedTabs } from "@/components/composites/SegmentedTabs";
import {
  useJwinBrandCampaign,
  useJwinPrizes,
  useJwinPostTemplates,
  useJwinStatusTransition,
  activationChecklist,
  postTemplateCoverage,
  PrizeTab,
  PostTemplateTab,
  ResultTab,
  StatusTransition,
} from "@/components/JwinCampaignForm";
import type { AdminBrandCampaignDetail } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./Jwin.module.css";

type TabKey = "prize" | "template" | "result";

const TAB_KEYS: TabKey[] = ["prize", "template", "result"];

/**
 * 참여(브랜드 × 시즌) 편집. 기간·이름은 시즌이 갖고 여기서는 게시 설정·경품·포스트·결과화면을 다룬다.
 * 페이지는 조립만 한다 — 데이터는 각 훅이, 판정은 순수 함수가 맡는다.
 */
export function JwinBrandCampaignEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const form = useJwinBrandCampaign(id ?? "");
  const [tab, setTab] = useState<TabKey>("prize");

  const tabs = useMemo(
    () => TAB_KEYS.map((key) => ({ key, label: t(`jwin.campaign.tabs.${key}` as const) })),
    [t],
  );

  // detail 이 이미 있으면 백그라운드 재조회일 뿐이므로 전체 화면 로딩/에러로 덮지 않는다.
  if (form.loading && !form.detail) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>{t("jwin.common.loading")}</div>
      </div>
    );
  }

  if (!form.detail) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>{form.loadError ?? t("jwin.common.loading")}</div>
      </div>
    );
  }

  const detail = form.detail;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <button
            type="button"
            className={styles.backLink}
            onClick={() => navigate(`/jwin/campaigns/${detail.campaign.id}`)}
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />{" "}
            {detail.campaign.name}
          </button>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{detail.brandAccount.label}</h1>
            {/* 연동 상태는 브랜드명 옆 배지로 — 정상이면 이것만, 문제면 아래 안내가 붙는다 */}
            <JwinAccountStatusBadge status={detail.brandAccount.status} />
            {detail.brandAccount.xUsername && (
              <span className={styles.titleMeta}>@{detail.brandAccount.xUsername}</span>
            )}
          </div>
        </div>
        <div className={styles.saveRow}>
          {form.saved && <span className={styles.saved}>{t("jwin.common.saved")}</span>}
          {form.error && <span className={styles.saveError}>{form.error}</span>}
          {/* detail 이 있는 상태에서의 loadError 는 백그라운드 재조회 실패이므로
              전체화면 대신 여기서 인라인으로 보여준다 (실패를 조용히 삼키지 않기 위함) */}
          {form.loadError && <span className={styles.saveError}>{form.loadError}</span>}
          <Button
            variant="primary"
            size="md"
            onClick={() => void form.save()}
            loading={form.saving}
          >
            {t("jwin.common.save")}
          </Button>
        </div>
      </div>

      {detail.brandAccount.status !== "CONNECTED" && (
        <p className={styles.connectNotice}>
          {t("jwin.connect.connectNote")}{" "}
          <a href={detail.brandAccount.connectUrl} target="_blank" rel="noreferrer">
            {detail.brandAccount.connectUrl}
          </a>{" "}
          · <Link to="/jwin/accounts">{t("jwin.connect.manageLink")}</Link>
        </p>
      )}

      <SegmentedTabs items={tabs} value={tab} onChange={setTab} />

      <div className={styles.tabContent}>
        <BrandCampaignEditBody
          brandCampaignId={detail.id}
          detail={detail}
          tab={tab}
          onDetailChanged={form.reload}
          dailyWinCap={form.values.dailyWinCap}
          onDailyWinCapChange={(value) => form.setField("dailyWinCap", value)}
        />
      </div>
    </div>
  );
}

/**
 * 경품·포스트를 함께 읽는 참여 편집 본문.
 * 상태 전환 체크리스트가 경품·포스트·커버리지를 모두 봐야 해서 한 곳에서 훅을 부른다.
 */
function BrandCampaignEditBody({
  brandCampaignId,
  detail,
  tab,
  onDetailChanged,
  dailyWinCap,
  onDailyWinCapChange,
}: {
  brandCampaignId: string;
  detail: AdminBrandCampaignDetail;
  tab: TabKey;
  onDetailChanged: () => void;
  dailyWinCap: string;
  onDailyWinCapChange: (value: string) => void;
}) {
  const prizes = useJwinPrizes(brandCampaignId);
  const postTemplates = useJwinPostTemplates(brandCampaignId);
  const transition = useJwinStatusTransition(brandCampaignId, onDetailChanged);

  const checks = useMemo(
    () =>
      activationChecklist({
        detail,
        prizes: prizes.prizes,
        // 커버리지는 시즌 기간을 기준으로 판정한다
        coverage: postTemplateCoverage(detail.campaign, postTemplates.templates),
      }),
    [detail, prizes.prizes, postTemplates.templates],
  );

  const hasCodePrize = prizes.prizes.some((prize) => prize.type === "CODE");
  // 상태 전환은 모든 탭 위에 걸리고, 본문 탭만 카드로 감싼다.
  const showTabCard = tab === "prize" || tab === "template" || tab === "result";

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

      {showTabCard && (
        <div className={styles.tabCard}>
          {tab === "prize" && (
            <PrizeTab
              prizes={prizes.prizes}
              loading={prizes.loading}
              loadError={prizes.loadError}
              onAdd={prizes.add}
              onEdit={prizes.edit}
              onAppendCodes={prizes.appendCodes}
              dailyWinCap={dailyWinCap}
              onDailyWinCapChange={onDailyWinCapChange}
            />
          )}

          {tab === "template" && (
            <PostTemplateTab
              detail={detail}
              templates={postTemplates.templates}
              loading={postTemplates.loading}
              loadError={postTemplates.loadError}
              onAdd={postTemplates.add}
              onEdit={postTemplates.edit}
              onDelete={postTemplates.remove}
            />
          )}

          {tab === "result" && (
            <ResultTab detail={detail} hasCodePrize={hasCodePrize} onSaved={onDetailChanged} />
          )}
        </div>
      )}
    </>
  );
}
