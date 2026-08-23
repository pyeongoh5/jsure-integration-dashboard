import { useEffect, useMemo, useState } from "react";
import { SUB_TYPE_LABEL } from "@jsure/shared";
import type { AdminInfluencer, SnsAccountSubType } from "@jsure/shared";
import {
  InfluencerNotesDialog,
  buildInfluencersCsv,
  influencersCsvFilename,
  listInfluencers,
} from "@/domains/influencer";
import { triggerCsvDownload } from "@/domains/application";
import { BroadcastDialog } from "@/domains/broadcast";
import { ScrollTable, SnsProfileLink } from "@/components/composites";
import {
  FilterChipBar,
  MultiSelectFilterChip,
} from "@/components/composites/FilterChip";
import { Button } from "@/components/ui";
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

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; rows: AdminInfluencer[] }
  | { kind: "error"; message: string };

export function Influencers() {
  const t = useT();
  const { language } = useLanguage();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [snsFilter, setSnsFilter] = useState<Set<SnsAccountSubType>>(
    () => new Set(),
  );
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [notesTarget, setNotesTarget] = useState<AdminInfluencer | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    listInfluencers()
      .then((rows) => {
        if (!cancelled) setState({ kind: "ready", rows });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            err instanceof Error ? err.message : t("pages.influencers.loadFailed"),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // 데이터에 실제로 존재하는 SNS 타입만 필터 옵션으로 노출.
  const snsOptions = useMemo(() => {
    if (state.kind !== "ready") return [];
    const present = new Set(state.rows.flatMap((r) => r.snsAccounts.map((s) => s.snsType)));
    return SNS_FILTER_ORDER.filter((type) => present.has(type)).map((type) => ({
      key: type,
      label: SUB_TYPE_LABEL[type],
      icon: SNS_ICON[type],
    }));
  }, [state]);

  const filtered = useMemo(() => {
    if (state.kind !== "ready") return [];
    const q = query.trim().toLowerCase();
    return state.rows.filter((r) => {
      // 다중 SNS 필터: 선택한 타입 중 하나라도 보유하면 표시 (미선택이면 전체).
      if (
        snsFilter.size > 0 &&
        !r.snsAccounts.some((s) => snsFilter.has(s.snsType))
      ) {
        return false;
      }
      if (!q) return true;
      return `${r.name} ${r.email} ${r.snsAccounts.map((s) => s.handle).join(" ")}`
        .toLowerCase()
        .includes(q);
    });
  }, [state, query, snsFilter]);

  return (
    <div className={styles.inf}>
      <div>
        <h1 className={styles.title}>{t("nav.items.influencers")}</h1>
        <p className={styles.subtitle}>
          {state.kind === "ready"
            ? t("pages.influencers.totalCount", { count: state.rows.length })
            : t("pages.influencers.loadingList")}
        </p>
      </div>
      <div className={styles.header}>
        <FilterChipBar>
          <MultiSelectFilterChip
            emptyLabel="+ SNS"
            labelPrefix="SNS"
            popoverTitle={t("pages.influencers.snsPopoverTitle")}
            options={snsOptions}
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
            onClick={() =>
              triggerCsvDownload(influencersCsvFilename(), buildInfluencersCsv(filtered))
            }
            disabled={state.kind !== "ready" || filtered.length === 0}
            iconLeft={<i className="fa-solid fa-download" aria-hidden="true" />}
          >
            {t("pages.influencers.csvDownload")}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setBroadcastOpen(true)}
            disabled={state.kind !== "ready"}
            iconLeft={<i className="fa-regular fa-paper-plane" aria-hidden="true" />}
          >
            {t("pages.influencers.sendMessage")}
          </Button>
        </div>
      </div>

      {state.kind === "loading" ? (
        <div className={styles.empty}>{t("common.loading")}</div>
      ) : state.kind === "error" ? (
        <div className={styles.empty}>
          {state.message}{" "}
          <Button variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            {t("common.retry")}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
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
                {filtered.map((r) => (
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
          </ScrollTable>
        </div>
      )}

      <BroadcastDialog
        open={broadcastOpen}
        candidates={filtered}
        onClose={() => setBroadcastOpen(false)}
      />

      {notesTarget && (
        <InfluencerNotesDialog
          influencerId={notesTarget.id}
          influencerName={notesTarget.name}
          onClose={() => setNotesTarget(null)}
          onChanged={() => setReloadKey((current) => current + 1)}
        />
      )}
    </div>
  );
}
