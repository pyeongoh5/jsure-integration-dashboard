import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "@/pages/Applicants/Applicants.module.css";
import { MEDIA_META, type CampaignOption, type Media } from "./types";

type PopoverKind = "campaign" | "media" | "followers";

type Props = {
  campaignId: string | null;
  campaignLabel: string | null; // resolved title (null while loading or unknown id)
  campaignsLoaded: boolean;
  campaignOptions: CampaignOption[]; // already filtered to non-closed
  onCampaignChange: (id: string | null) => void;

  mediaFilter: Set<Media>;
  onMediaChange: (next: Set<Media>) => void;

  // 팔로워 필터는 응모 관리 페이지 전용 — 검토 페이지에서는 props 자체를 생략하면 버튼이 사라진다.
  minFollowers?: number | null;
  onMinFollowersChange?: (followers: number | null) => void;
};

export function ApplicantFilters({
  campaignId,
  campaignLabel,
  campaignsLoaded,
  campaignOptions,
  onCampaignChange,
  mediaFilter,
  onMediaChange,
  minFollowers,
  onMinFollowersChange,
}: Props) {
  const [popover, setPopover] = useState<{ kind: PopoverKind; rect: DOMRect } | null>(null);
  const [minFollowersDraft, setMinFollowersDraft] = useState<string>("");
  const [campaignQuery, setCampaignQuery] = useState<string>("");

  const campaignBtnRef = useRef<HTMLButtonElement | null>(null);
  const mediaBtnRef = useRef<HTMLButtonElement | null>(null);
  const followersBtnRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popover) return;
    const onDocPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      if (campaignBtnRef.current && campaignBtnRef.current.contains(target))
        return;
      if (mediaBtnRef.current && mediaBtnRef.current.contains(target)) return;
      if (followersBtnRef.current && followersBtnRef.current.contains(target))
        return;
      setPopover(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPopover(null);
    };
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [popover]);

  const followersEnabled = onMinFollowersChange !== undefined;
  const currentMinFollowers = minFollowers ?? null;

  const openPopover = (kind: PopoverKind) => {
    const anchorButton =
      kind === "campaign"
        ? campaignBtnRef.current
        : kind === "media"
          ? mediaBtnRef.current
          : followersBtnRef.current;
    if (!anchorButton) return;
    if (popover?.kind === kind) {
      setPopover(null);
      return;
    }
    if (kind === "followers") {
      setMinFollowersDraft(
        currentMinFollowers !== null ? String(currentMinFollowers) : "",
      );
    }
    if (kind === "campaign") {
      setCampaignQuery("");
    }
    setPopover({ kind, rect: anchorButton.getBoundingClientRect() });
  };

  const toggleMedia = (media: Media) => {
    const next = new Set(mediaFilter);
    if (next.has(media)) next.delete(media);
    else next.add(media);
    onMediaChange(next);
  };

  const applyFollowers = () => {
    if (!onMinFollowersChange) {
      setPopover(null);
      return;
    }
    const raw = minFollowersDraft.trim();
    if (raw === "") {
      onMinFollowersChange(null);
    } else {
      const parsed = Number(raw);
      if (Number.isInteger(parsed) && parsed >= 0) onMinFollowersChange(parsed);
    }
    setPopover(null);
  };

  const clear = (kind: PopoverKind) => {
    if (kind === "campaign") onCampaignChange(null);
    else if (kind === "media") onMediaChange(new Set());
    else if (kind === "followers") onMinFollowersChange?.(null);
  };

  return (
    <>
      <div className={styles.filters}>
        <button
          ref={campaignBtnRef}
          type="button"
          className={`${styles.filter} ${campaignId ? styles.filterActive : ""}`}
          onClick={() => openPopover("campaign")}
        >
          {campaignId
            ? `캠페인: ${campaignLabel ?? (campaignsLoaded ? campaignId : "불러오는 중…")}`
            : "+ 캠페인"}
          {campaignId && (
            <span
              className={styles.popoverBtn}
              onClick={(event) => {
                event.stopPropagation();
                clear("campaign");
                setPopover(null);
              }}
            >
              {" "}
              ✕
            </span>
          )}
        </button>

        {followersEnabled && (
          <button
            ref={followersBtnRef}
            type="button"
            className={`${styles.filter} ${currentMinFollowers !== null ? styles.filterActive : ""}`}
            onClick={() => openPopover("followers")}
          >
            {currentMinFollowers !== null
              ? `팔로워 ${currentMinFollowers.toLocaleString()}명 이상`
              : "+ 팔로워 범위"}
            {currentMinFollowers !== null && (
              <span
                className={styles.popoverBtn}
                onClick={(event) => {
                  event.stopPropagation();
                  clear("followers");
                  setPopover(null);
                }}
              >
                {" "}
                ✕
              </span>
            )}
          </button>
        )}

        <button
          ref={mediaBtnRef}
          type="button"
          className={`${styles.filter} ${mediaFilter.size > 0 ? styles.filterActive : ""}`}
          onClick={() => openPopover("media")}
        >
          {mediaFilter.size > 0
            ? `매체: ${Array.from(mediaFilter)
                .map((media) => MEDIA_META[media].label)
                .join(", ")}`
            : "+ 매체"}
          {mediaFilter.size > 0 && (
            <span
              className={styles.popoverBtn}
              onClick={(event) => {
                event.stopPropagation();
                clear("media");
                setPopover(null);
              }}
            >
              {" "}
              ✕
            </span>
          )}
        </button>
      </div>

      {popover &&
        createPortal(
          <div
            ref={popoverRef}
            className={styles.popover}
            style={{ top: popover.rect.bottom + 6, left: popover.rect.left }}
          >
            {popover.kind === "campaign" ? (
              <>
                <div className={styles.popoverTitle}>캠페인 선택 (진행중)</div>
                <div className={styles.popoverInputRow}>
                  <input
                    type="text"
                    className={styles.popoverInput}
                    placeholder="캠페인 검색"
                    autoFocus
                    value={campaignQuery}
                    onChange={(event) => setCampaignQuery(event.target.value)}
                  />
                </div>
                {(() => {
                  const query = campaignQuery.trim().toLowerCase();
                  const filteredCampaigns = query
                    ? campaignOptions.filter((campaign) =>
                        campaign.title.toLowerCase().includes(query),
                      )
                    : campaignOptions;
                  if (campaignOptions.length === 0) {
                    return (
                      <div className={styles.popoverEmpty}>
                        진행중인 캠페인이 없습니다.
                      </div>
                    );
                  }
                  if (filteredCampaigns.length === 0) {
                    return (
                      <div className={styles.popoverEmpty}>
                        검색 결과가 없습니다.
                      </div>
                    );
                  }
                  return (
                    <div className={`${styles.popoverItems} ${styles.popoverItemsScroll}`}>
                      {filteredCampaigns.map((campaign) => {
                        const selected = campaign.id === campaignId;
                        return (
                          <button
                            key={campaign.id}
                            type="button"
                            className={`${styles.popoverOption}${
                              selected ? ` ${styles.popoverOptionOn}` : ""
                            }`}
                            onClick={() => {
                              onCampaignChange(campaign.id);
                              setPopover(null);
                            }}
                          >
                            <span className={styles.popoverOptionLabel}>
                              {campaign.title}
                            </span>
                            {selected && (
                              <i className={`fa-solid fa-check ${styles.popoverOptionCheck}`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
                <div className={styles.popoverActions}>
                  <button
                    type="button"
                    className={`${styles.popoverBtn} ${styles.popoverBtnPrimary}`}
                    onClick={() => setPopover(null)}
                  >
                    닫기
                  </button>
                </div>
              </>
            ) : popover.kind === "media" ? (
              <>
                <div className={styles.popoverTitle}>매체 선택 (복수 가능)</div>
                <div className={styles.popoverItems}>
                  {(Object.keys(MEDIA_META) as Media[]).map((media) => {
                    const selected = mediaFilter.has(media);
                    return (
                      <button
                        key={media}
                        type="button"
                        className={`${styles.popoverOption}${
                          selected ? ` ${styles.popoverOptionOn}` : ""
                        }`}
                        onClick={() => toggleMedia(media)}
                      >
                        <i
                          className={`${MEDIA_META[media].icon} ${styles.popoverOptionIcon}`}
                        />
                        <span className={styles.popoverOptionLabel}>
                          {MEDIA_META[media].label}
                        </span>
                        {selected && (
                          <i className={`fa-solid fa-check ${styles.popoverOptionCheck}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.popoverActions}>
                  <button
                    type="button"
                    className={`${styles.popoverBtn} ${styles.popoverBtnPrimary}`}
                    onClick={() => setPopover(null)}
                  >
                    닫기
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.popoverTitle}>팔로워 최소값</div>
                <div className={styles.popoverInputRow}>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={styles.popoverInput}
                    placeholder="예: 10000"
                    autoFocus
                    value={minFollowersDraft}
                    onChange={(event) => setMinFollowersDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyFollowers();
                      }
                    }}
                  />
                  <span className={styles.popoverSuffix}>명 이상</span>
                </div>
                <div className={styles.popoverActions}>
                  <button
                    type="button"
                    className={`${styles.popoverBtn} ${styles.popoverBtnPrimary}`}
                    onClick={applyFollowers}
                  >
                    적용
                  </button>
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
