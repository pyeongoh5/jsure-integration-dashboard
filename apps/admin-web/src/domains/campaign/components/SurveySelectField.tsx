import { useEffect, useState } from "react";
import type { BuilderSurveyListItem } from "@jsure/shared";
import { listSurveysPage } from "@/domains/builderSurvey";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useT } from "@/lib/i18n";
import styles from "./SurveySelectField.module.css";

/** 검색 결과 한 페이지 분량. 더 찾으려면 검색어를 좁히면 된다 — 더보기는 범위 밖. */
const SEARCH_PAGE_SIZE = 20;

type Props = {
  value: string | null;
  onChange: (surveyId: string | null) => void;
  /**
   * 현재 연결된 설문의 제목. 30건 커서 페이지네이션이라 연결된 설문이 검색
   * 결과 밖에 있을 수 있어, 목록과 무관하게 항상 이 제목으로 현재 선택을 보여준다.
   */
  selectedSurveyTitle?: string | null;
  disabled?: boolean;
};

/**
 * 캠페인에 연결할 앙케이트를 고르는 필드. 검색 입력 상태를 자기 안에서 들고
 * 서버에 `q` 로 재조회한다 — 부모(CampaignForm)가 리렌더돼도 이 입력의
 * 포커스·IME 조합이 깨지지 않게 하기 위함이다.
 */
export function SurveySelectField({
  value,
  onChange,
  selectedSurveyTitle,
  disabled,
}: Props) {
  const t = useT();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [items, setItems] = useState<BuilderSurveyListItem[]>([]);
  const [loading, setLoading] = useState(false);
  // 사용자가 이 필드에서 직접 고른 설문의 제목. 고르기 전에는 null 이고,
  // 그동안은 selectedSurveyTitle(부모가 쥔 기존 연결 제목)을 보여준다.
  const [pickedTitle, setPickedTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSurveysPage(null, SEARCH_PAGE_SIZE, debouncedQuery.trim() || undefined)
      .then((page) => {
        if (!cancelled) setItems(page.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  function select(survey: BuilderSurveyListItem | null) {
    setPickedTitle(survey ? survey.title : null);
    onChange(survey ? survey.id : null);
  }

  const displayTitle = value === null ? null : (pickedTitle ?? selectedSurveyTitle ?? null);

  function renderResultRows() {
    if (loading) return <div className={styles.empty}>{t("common.loading")}</div>;
    if (items.length === 0) {
      return <div className={styles.empty}>{t("domains.campaign.form.surveySelectEmpty")}</div>;
    }
    return items.map((survey) => (
      <label
        key={survey.id}
        className={`${styles.row} ${value === survey.id ? styles.rowChecked : ""}`}
      >
        <input
          type="radio"
          checked={value === survey.id}
          onChange={() => select(survey)}
          disabled={disabled}
        />
        <span className={styles.rowTitle}>{survey.title}</span>
      </label>
    ));
  }

  return (
    <div className={styles.root}>
      <div className={styles.current}>
        {displayTitle
          ? t("domains.campaign.form.surveySelectCurrent", { title: displayTitle })
          : t("domains.campaign.form.surveySelectNone")}
      </div>

      <input
        type="text"
        className={styles.search}
        placeholder={t("domains.campaign.form.surveySelectSearchPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={disabled}
      />

      <div className={styles.list}>
        <label className={`${styles.row} ${value === null ? styles.rowChecked : ""}`}>
          <input
            type="radio"
            checked={value === null}
            onChange={() => select(null)}
            disabled={disabled}
          />
          <span className={styles.rowTitle}>
            {t("domains.campaign.form.surveySelectNoneOption")}
          </span>
        </label>
        {renderResultRows()}
      </div>

      <p className={styles.hint}>{t("domains.campaign.form.surveySelectHint")}</p>
      <p className={styles.hint}>{t("domains.campaign.form.surveySelectChangeNotice")}</p>
    </div>
  );
}
