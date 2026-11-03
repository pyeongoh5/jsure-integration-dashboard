import { useEffect, useState } from "react";
import {
  EMPTY_INFLUENCER_FILTER,
  type AdminInfluencer,
} from "@jsure/shared";
import { listInfluencersPage } from "@/domains/influencer";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useT } from "@/lib/i18n";
import styles from "./ExcludedCampaignsPicker.module.css";

type Props = {
  /** 선택된 인플루언서 id. 표시 이름은 이 컴포넌트가 따로 기억한다. */
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

/** 한 글자 검색은 후보가 너무 많아 의미가 없다. */
const MIN_QUERY_LENGTH = 2;
const SEARCH_LIMIT = 20;

/**
 * 비공개 캠페인 대상자를 한 명씩 검색해 추가하는 입력.
 *
 * 폼이 들고 있는 값은 id 뿐이라, 칩에 보여줄 이름은 검색 결과에서 주워 이 컴포넌트가
 * 기억한다. 기억에 없는 id(폼 외부에서 들어온 값)는 id 를 그대로 보여준다.
 */
export function AudienceInfluencerPicker({ value, onChange, disabled }: Props) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminInfluencer[]>([]);
  const [searching, setSearching] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const debouncedQuery = useDebouncedValue(query.trim());

  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    listInfluencersPage(
      { ...EMPTY_INFLUENCER_FILTER, query: debouncedQuery },
      null,
      SEARCH_LIMIT,
    )
      .then((page) => {
        if (!cancelled) setResults(page.influencers);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const selectedIds = new Set(value);

  const add = (influencer: AdminInfluencer) => {
    if (selectedIds.has(influencer.id)) return;
    setLabels((current) => ({
      ...current,
      [influencer.id]: `${influencer.name} (${influencer.email})`,
    }));
    onChange([...value, influencer.id]);
  };

  const remove = (influencerId: string) => {
    onChange(value.filter((current) => current !== influencerId));
  };

  return (
    <div className={styles.root}>
      <div className={styles.selected}>
        {value.length === 0 ? (
          <div className={styles.empty}>
            {t("domains.campaign.excludedPicker.noneSelected")}
          </div>
        ) : (
          value.map((influencerId) => (
            <span key={influencerId} className={styles.chip}>
              {labels[influencerId] ?? influencerId}
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => remove(influencerId)}
                disabled={disabled}
                aria-label={t("domains.campaign.excludedPicker.removeAria")}
              >
                ✕
              </button>
            </span>
          ))
        )}
      </div>

      <input
        type="text"
        className={styles.search}
        placeholder={t("domains.campaign.audience.searchPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={disabled}
      />

      <div className={styles.list}>
        <AudienceSearchResults
          query={debouncedQuery}
          searching={searching}
          results={results}
          selectedIds={selectedIds}
          disabled={disabled}
          onAdd={add}
        />
      </div>
    </div>
  );
}

type ResultsProps = {
  query: string;
  searching: boolean;
  results: AdminInfluencer[];
  selectedIds: Set<string>;
  disabled?: boolean;
  onAdd: (influencer: AdminInfluencer) => void;
};

/** 검색 상태별 표시 — 중첩 삼항 대신 early return 으로 분기한다. */
function AudienceSearchResults({
  query,
  searching,
  results,
  selectedIds,
  disabled,
  onAdd,
}: ResultsProps) {
  const t = useT();
  if (query.length < MIN_QUERY_LENGTH) {
    return (
      <div className={styles.empty}>
        {t("domains.campaign.audience.searchHintShort")}
      </div>
    );
  }
  if (searching) {
    return <div className={styles.empty}>{t("common.loading")}</div>;
  }
  if (results.length === 0) {
    return (
      <div className={styles.empty}>
        {t("domains.campaign.audience.searchNoResults")}
      </div>
    );
  }
  return (
    <>
      {results.map((influencer) => {
        const picked = selectedIds.has(influencer.id);
        return (
          <div key={influencer.id} className={styles.row}>
            <span className={styles.rowTitle}>{influencer.name}</span>
            <span className={styles.rowMeta}>{influencer.email}</span>
            <button
              type="button"
              className={styles.chipRemove}
              onClick={() => onAdd(influencer)}
              disabled={disabled || picked}
            >
              {picked
                ? t("domains.campaign.audience.added")
                : t("domains.campaign.audience.add")}
            </button>
          </div>
        );
      })}
    </>
  );
}
