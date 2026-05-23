import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MEDIA_META, type CampaignOption, type Media } from "./types";

type PopoverKind = "campaign" | "media" | "followers";

type Props = {
  campaignId: string | null;
  campaignLabel: string | null; // resolved title (or fallback to id)
  campaignOptions: CampaignOption[]; // already filtered to non-closed
  onCampaignChange: (id: string | null) => void;

  mediaFilter: Set<Media>;
  onMediaChange: (next: Set<Media>) => void;

  minFollowers: number | null;
  onMinFollowersChange: (n: number | null) => void;
};

export function ApplicantFilters({
  campaignId,
  campaignLabel,
  campaignOptions,
  onCampaignChange,
  mediaFilter,
  onMediaChange,
  minFollowers,
  onMinFollowersChange,
}: Props) {
  const [popover, setPopover] = useState<{ kind: PopoverKind; rect: DOMRect } | null>(null);
  const [minFollowersDraft, setMinFollowersDraft] = useState<string>("");

  const campaignBtnRef = useRef<HTMLButtonElement | null>(null);
  const mediaBtnRef = useRef<HTMLButtonElement | null>(null);
  const followersBtnRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popover) return;
    const onDocPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popoverRef.current && popoverRef.current.contains(t)) return;
      if (campaignBtnRef.current && campaignBtnRef.current.contains(t)) return;
      if (mediaBtnRef.current && mediaBtnRef.current.contains(t)) return;
      if (followersBtnRef.current && followersBtnRef.current.contains(t)) return;
      setPopover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopover(null);
    };
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [popover]);

  const openPopover = (kind: PopoverKind) => {
    const btn =
      kind === "campaign"
        ? campaignBtnRef.current
        : kind === "media"
          ? mediaBtnRef.current
          : followersBtnRef.current;
    if (!btn) return;
    if (popover?.kind === kind) {
      setPopover(null);
      return;
    }
    if (kind === "followers") {
      setMinFollowersDraft(minFollowers !== null ? String(minFollowers) : "");
    }
    setPopover({ kind, rect: btn.getBoundingClientRect() });
  };

  const toggleMedia = (m: Media) => {
    const next = new Set(mediaFilter);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    onMediaChange(next);
  };

  const applyFollowers = () => {
    const raw = minFollowersDraft.trim();
    if (raw === "") {
      onMinFollowersChange(null);
    } else {
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 0) onMinFollowersChange(n);
    }
    setPopover(null);
  };

  const clear = (kind: PopoverKind) => {
    if (kind === "campaign") onCampaignChange(null);
    else if (kind === "media") onMediaChange(new Set());
    else onMinFollowersChange(null);
  };

  return (
    <>
      <div className="apl__filters">
        <button
          ref={campaignBtnRef}
          type="button"
          className={`apl-filter ${campaignId ? "apl-filter--active" : ""}`}
          onClick={() => openPopover("campaign")}
        >
          {campaignId ? `캠페인: ${campaignLabel ?? campaignId}` : "+ 캠페인"}
          {campaignId && (
            <span
              className="apl-popover__btn"
              onClick={(e) => {
                e.stopPropagation();
                clear("campaign");
                setPopover(null);
              }}
            >
              {" "}
              ✕
            </span>
          )}
        </button>

        <button
          ref={followersBtnRef}
          type="button"
          className={`apl-filter ${minFollowers !== null ? "apl-filter--active" : ""}`}
          onClick={() => openPopover("followers")}
        >
          {minFollowers !== null
            ? `팔로워 ${minFollowers.toLocaleString()}명 이상`
            : "+ 팔로워 범위"}
          {minFollowers !== null && (
            <span
              className="apl-popover__btn"
              onClick={(e) => {
                e.stopPropagation();
                clear("followers");
                setPopover(null);
              }}
            >
              {" "}
              ✕
            </span>
          )}
        </button>

        <button
          ref={mediaBtnRef}
          type="button"
          className={`apl-filter ${mediaFilter.size > 0 ? "apl-filter--active" : ""}`}
          onClick={() => openPopover("media")}
        >
          {mediaFilter.size > 0
            ? `매체: ${Array.from(mediaFilter)
                .map((m) => MEDIA_META[m].label)
                .join(", ")}`
            : "+ 매체"}
          {mediaFilter.size > 0 && (
            <span
              className="apl-popover__btn"
              onClick={(e) => {
                e.stopPropagation();
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
            className="apl-popover"
            style={{ top: popover.rect.bottom + 6, left: popover.rect.left }}
          >
            {popover.kind === "campaign" ? (
              <>
                <div className="apl-popover__title">캠페인 선택 (진행중)</div>
                {campaignOptions.length === 0 ? (
                  <div className="apl-popover__empty">진행중인 캠페인이 없습니다.</div>
                ) : (
                  <div className="apl-popover__items apl-popover__items--scroll">
                    {campaignOptions.map((c) => {
                      const selected = c.id === campaignId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`apl-popover__option${
                            selected ? " apl-popover__option--on" : ""
                          }`}
                          onClick={() => {
                            onCampaignChange(c.id);
                            setPopover(null);
                          }}
                        >
                          <span className="apl-popover__option-label">{c.title}</span>
                          {selected && (
                            <i className="fa-solid fa-check apl-popover__option-check" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="apl-popover__actions">
                  <button
                    type="button"
                    className="apl-popover__btn apl-popover__btn--primary"
                    onClick={() => setPopover(null)}
                  >
                    닫기
                  </button>
                </div>
              </>
            ) : popover.kind === "media" ? (
              <>
                <div className="apl-popover__title">매체 선택 (복수 가능)</div>
                <div className="apl-popover__items">
                  {(Object.keys(MEDIA_META) as Media[]).map((m) => {
                    const selected = mediaFilter.has(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        className={`apl-popover__option${
                          selected ? " apl-popover__option--on" : ""
                        }`}
                        onClick={() => toggleMedia(m)}
                      >
                        <i className={`${MEDIA_META[m].icon} apl-popover__option-icon`} />
                        <span className="apl-popover__option-label">
                          {MEDIA_META[m].label}
                        </span>
                        {selected && (
                          <i className="fa-solid fa-check apl-popover__option-check" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="apl-popover__actions">
                  <button
                    type="button"
                    className="apl-popover__btn apl-popover__btn--primary"
                    onClick={() => setPopover(null)}
                  >
                    닫기
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="apl-popover__title">팔로워 최소값</div>
                <div className="apl-popover__input-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="apl-popover__input"
                    placeholder="예: 10000"
                    autoFocus
                    value={minFollowersDraft}
                    onChange={(e) => setMinFollowersDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyFollowers();
                      }
                    }}
                  />
                  <span className="apl-popover__suffix">명 이상</span>
                </div>
                <div className="apl-popover__actions">
                  <button
                    type="button"
                    className="apl-popover__btn apl-popover__btn--primary"
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
