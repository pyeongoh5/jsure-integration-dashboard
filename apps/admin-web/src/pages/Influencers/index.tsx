import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ENABLED_SNS_TYPES,
  INFLUENCER_EXPORT_MAX_ROWS,
  InfluencerFilterSchema,
  SUB_TYPE_LABEL,
} from "@jsure/shared";
import type {
  AdminInfluencer,
  InfluencerFilter,
  SnsAccountSubType,
} from "@jsure/shared";
import {
  InfluencerNotesDialog,
  buildInfluencersCsv,
  exportInfluencers,
  influencersCsvFilename,
  useInfluencersData,
} from "@/domains/influencer";
import { triggerCsvDownload } from "@/domains/application";
import { BroadcastDialog } from "@/domains/broadcast";
import { ScrollTable, SnsProfileLink } from "@/components/composites";
import {
  FilterChipBar,
  MultiSelectFilterChip,
} from "@/components/composites/FilterChip";
import { Button } from "@/components/ui";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useLanguage, useT } from "@/lib/i18n";
import styles from "./Influencers.module.css";

// SNS 필터 옵션 순서 (테이블 아이콘 순서와 동일).
const SNS_FILTER_ORDER: SnsAccountSubType[] = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"];

const SNS_ICON: Record<SnsAccountSubType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  X: "fa-brands fa-x-twitter",
  YOUTUBE: "fa-brands fa-youtube",
};

const SNS_CLASS: Record<SnsAccountSubType, string | undefined> = {
  INSTAGRAM: styles.snsIg,
  TIKTOK: styles.snsTt,
  X: styles.snsX,
  YOUTUBE: styles.snsYt,
};

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${parseFloat((n / 1_000).toFixed(1))}K`;
  return String(n);
}

const AVATAR_PALETTE = [
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
];

function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length] ?? "#6b7280";
}

// 활성 SNS 채널은 항상 노출한다. 커서 페이징에서는 불러온 페이지에 담긴 채널만
// 옵션으로 두면 1페이지 구성에 따라 목록이 흔들린다. 인원 0명인 채널도 보이는 편이
// 모수 확인이라는 목적에 맞다(선택 시 "총 0명").
const SNS_FILTER_OPTIONS = SNS_FILTER_ORDER.filter((type) =>
  ENABLED_SNS_TYPES.includes(type),
).map((type) => ({
  key: type,
  label: SUB_TYPE_LABEL[type],
  icon: SNS_ICON[type],
}));

export function Influencers() {
  const t = useT();
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [snsFilter, setSnsFilter] = useState<Set<SnsAccountSubType>>(
    () => new Set(),
  );
  const [broadcastCandidates, setBroadcastCandidates] = useState<
    AdminInfluencer[] | null
  >(null);
  const [broadcastPending, setBroadcastPending] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [csvPending, setCsvPending] = useState(false);
  const [notesTarget, setNotesTarget] = useState<AdminInfluencer | null>(null);

  // 선택 순서가 다른 쿼리 키를 만들지 않도록 정렬해서 넣는다.
  const filter = useMemo<InfluencerFilter>(
    () =>
      InfluencerFilterSchema.parse({
        snsTypes: [...snsFilter].sort(),
        query: debouncedQuery,
      }),
    [snsFilter, debouncedQuery],
  );

  const { state, influencers, total, hasMore, loadingMore, loadMore, reload } =
    useInfluencersData(filter);

  // 목록 끝 감시자가 보이면 다음 페이지를 이어 붙인다. 이 화면은 응모자 목록과 달리
  // 테이블이 아니라 페이지 자체가 세로로 스크롤된다 — 카드가 남은 높이를 채우는
  // flex 컬럼이 아니라 내용만큼 늘어나기 때문이다. 그래서 root 는 뷰포트로 둔다.
  // ScrollTable 을 root 로 잡으면 그 박스가 목록 전체 높이라 감시자가 늘 안쪽에
  // 있게 되고, 스크롤하지 않아도 끝까지 연달아 불러온다.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // 콜백은 ref 로 갈아끼운다. loadMore 를 의존성에 두면 페치 상태가 토글될 때마다
  // 감시자가 재등록되고, 이미 보이는 감시 영역에 대해 콜백이 즉시 다시 울려
  // 페이지가 연달아 요청된다. 재등록은 행이 늘어난 뒤 한 번만 —
  // 목록이 화면을 다 못 채웠을 때 다음 페이지를 이어 받기 위해.
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current();
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, influencers.length]);

  const handleCsvDownload = useCallback(async () => {
    setCsvPending(true);
    setActionMessage(null);
    try {
      // 화면에 불러온 페이지가 아니라 필터에 걸린 인플루언서 전체를 받아온다.
      const response = await exportInfluencers(filter);
      if (response.influencers.length === 0) {
        setActionMessage(t("pages.influencers.csvEmpty"));
        return;
      }
      triggerCsvDownload(
        influencersCsvFilename(),
        buildInfluencersCsv(response.influencers),
      );
      if (response.truncated) {
        setActionMessage(
          t("pages.influencers.csvTruncated", {
            count: INFLUENCER_EXPORT_MAX_ROWS,
          }),
        );
      }
    } catch (cause) {
      setActionMessage(
        cause instanceof Error ? cause.message : t("pages.influencers.csvFailed"),
      );
    } finally {
      setCsvPending(false);
    }
  }, [filter, t]);

  // 발송 대상도 필터에 걸린 전체다. 후보를 다 받은 뒤에 다이얼로그를 연다 —
  // 개별 선택 UI 가 불러온 페이지만 보여주면 상단 총 건수와 어긋난다.
  const handleOpenBroadcast = useCallback(async () => {
    setBroadcastPending(true);
    setActionMessage(null);
    try {
      const response = await exportInfluencers(filter);
      setBroadcastCandidates(response.influencers);
      if (response.truncated) {
        setActionMessage(
          t("pages.influencers.broadcastTruncated", {
            count: INFLUENCER_EXPORT_MAX_ROWS,
          }),
        );
      }
    } catch (cause) {
      setActionMessage(
        cause instanceof Error
          ? cause.message
          : t("pages.influencers.broadcastLoadFailed"),
      );
    } finally {
      setBroadcastPending(false);
    }
  }, [filter, t]);

  return (
    <div className={styles.inf}>
      <div>
        <h1 className={styles.title}>{t("nav.items.influencers")}</h1>
        <p className={styles.subtitle}>
          {state.kind === "ready"
            ? t("pages.influencers.totalCount", { count: total })
            : t("pages.influencers.loadingList")}
        </p>
      </div>
      <div className={styles.header}>
        <FilterChipBar>
          <MultiSelectFilterChip
            emptyLabel="+ SNS"
            labelPrefix="SNS"
            popoverTitle={t("pages.influencers.snsPopoverTitle")}
            options={SNS_FILTER_OPTIONS}
            value={snsFilter}
            onChange={setSnsFilter}
          />
        </FilterChipBar>
        <div className={styles.headerActions}>
          <div className={styles.search}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              placeholder={t("pages.influencers.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={handleCsvDownload}
            disabled={csvPending || state.kind !== "ready" || total === 0}
            iconLeft={<i className="fa-solid fa-download" aria-hidden="true" />}
          >
            {csvPending
              ? t("pages.influencers.csvDownloading")
              : t("pages.influencers.csvDownload")}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenBroadcast}
            disabled={broadcastPending || state.kind !== "ready" || total === 0}
            iconLeft={<i className="fa-regular fa-paper-plane" aria-hidden="true" />}
          >
            {broadcastPending
              ? t("pages.influencers.sendMessagePreparing")
              : t("pages.influencers.sendMessage")}
          </Button>
        </div>
      </div>
      {actionMessage && <p className={styles.actionMessage}>{actionMessage}</p>}

      {state.kind === "loading" ? (
        <div className={styles.empty}>{t("common.loading")}</div>
      ) : state.kind === "error" ? (
        <div className={styles.empty}>
          {state.message}{" "}
          <Button variant="secondary" size="sm" onClick={reload}>
            {t("common.retry")}
          </Button>
        </div>
      ) : total === 0 ? (
        <div className={styles.empty}>{t("pages.influencers.emptyFiltered")}</div>
      ) : (
        <div className={styles.card}>
          <ScrollTable>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("pages.influencers.table.emailPhone")}</th>
                  <th>{t("pages.influencers.table.snsAccounts")}</th>
                  <th title={t("pages.influencers.table.crossPostTitle")}>
                    {t("pages.influencers.table.crossPost")}
                  </th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.joinedAt")}</th>
                  <th style={{ width: 90 }}>
                    {t("domains.application.applicants.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {influencers.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className={styles.name}>
                        <span
                          className={styles.avatar}
                          style={{ background: pickAvatarColor(r.id) }}
                        >
                          {r.name[0]}
                        </span>
                        <div>
                          <div className={styles.nameText}>
                            {r.name}
                            {r.flagged && (
                              <span className={styles.flaggedBadge}>
                                {t("domains.application.applicants.table.flagged")}
                              </span>
                            )}
                          </div>
                          {r.nameKana && <div className={styles.nameSub}>{r.nameKana}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.contact}>{r.email}</div>
                      <div className={`${styles.contact} ${styles.contactSub}`}>{r.phone}</div>
                    </td>
                    <td>
                      {r.snsAccounts.length === 0 ? (
                        <span className={styles.emptyCell}>—</span>
                      ) : (
                        <div className={styles.snsList}>
                          {r.snsAccounts.map((s) => (
                            <SnsProfileLink
                              key={s.snsType}
                              subType={s.snsType}
                              handle={s.handle}
                            >
                              <span
                                className={`${styles.sns} ${SNS_CLASS[s.snsType]}`}
                                title={`@${s.handle}`}
                              >
                                <i className={SNS_ICON[s.snsType]} />
                                <span className={styles.snsHandle}>@{s.handle}</span>
                                <span className={styles.snsCount}>
                                  {formatFollowers(s.followerCount)}
                                </span>
                              </span>
                            </SnsProfileLink>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {r.crossPostCount === 0 ? (
                        <span className={styles.emptyCell}>—</span>
                      ) : (
                        t("common.itemCount", { count: r.crossPostCount })
                      )}
                    </td>
                    <td>
                      <span
                        className={`${styles.status} ${
                          r.status === "ACTIVE" ? styles.statusActive : styles.statusSuspended
                        }`}
                      >
                        {r.status === "ACTIVE" ? t("common.active") : t("common.suspended")}
                      </span>
                    </td>
                    <td className={styles.date}>
                      {new Date(r.createdAt).toLocaleDateString(language, {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </td>
                    <td>
                      <Button variant="secondary" size="sm" onClick={() => setNotesTarget(r)}>
                        {t("domains.application.applicants.actions.memo")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div ref={sentinelRef} className={styles.sentinel}>
              {loadingMore ? t("pages.influencers.loadingMore") : null}
            </div>
          </ScrollTable>
        </div>
      )}

      <BroadcastDialog
        open={broadcastCandidates !== null}
        candidates={broadcastCandidates ?? []}
        onClose={() => setBroadcastCandidates(null)}
      />

      {notesTarget && (
        <InfluencerNotesDialog
          influencerId={notesTarget.id}
          influencerName={notesTarget.name}
          onClose={() => setNotesTarget(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
