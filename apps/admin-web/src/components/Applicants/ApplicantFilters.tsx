import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MEDIA_META,
  STAGE_OPTIONS,
  type ApplicantStage,
  type CampaignOption,
  type Media,
} from "./types";

type PopoverKind = "campaign" | "media" | "followers" | "stage";

type Props = {
  campaignId: string | null;
  campaignLabel: string | null; // resolved title (null while loading or unknown id)
  campaignsLoaded: boolean;
  campaignOptions: CampaignOption[]; // already filtered to non-closed
  onCampaignChange: (id: string | null) => void;

  mediaFilter: Set<Media>;
  onMediaChange: (next: Set<Media>) => void;

  minFollowers: number | null;
  onMinFollowersChange: (followers: number | null) => void;

  showStageFilter: boolean;
  stageFilter: Set<ApplicantStage>;
  onStageChange: (next: Set<ApplicantStage>) => void;
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
  showStageFilter,
  stageFilter,
  onStageChange,
}: Props) {
  const [popover, setPopover] = useState<{ kind: PopoverKind; rect: DOMRect } | null>(null);
  const [minFollowersDraft, setMinFollowersDraft] = useState<string>("");

  const campaignBtnRef = useRef<HTMLButtonElement | null>(null);
  const mediaBtnRef = useRef<HTMLButtonElement | null>(null);
  const followersBtnRef = useRef<HTMLButtonElement | null>(null);
  const stageBtnRef = useRef<HTMLButtonElement | null>(null);
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
      if (stageBtnRef.current && stageBtnRef.current.contains(target)) return;
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

  const openPopover = (kind: PopoverKind) => {
    const anchorButton =
      kind === "campaign"
        ? campaignBtnRef.current
        : kind === "media"
          ? mediaBtnRef.current
          : kind === "followers"
            ? followersBtnRef.current
            : stageBtnRef.current;
    if (!anchorButton) return;
    if (popover?.kind === kind) {
      setPopover(null);
      return;
    }
    if (kind === "followers") {
      setMinFollowersDraft(minFollowers !== null ? String(minFollowers) : "");
    }
    setPopover({ kind, rect: anchorButton.getBoundingClientRect() });
  };

  const toggleMedia = (media: Media) => {
    const next = new Set(mediaFilter);
    if (next.has(media)) next.delete(media);
    else next.add(media);
    onMediaChange(next);
  };

  const toggleStage = (stage: ApplicantStage) => {
    const next = new Set(stageFilter);
    if (next.has(stage)) next.delete(stage);
    else next.add(stage);
    onStageChange(next);
  };

  const applyFollowers = () => {
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
    else if (kind === "followers") onMinFollowersChange(null);
    else onStageChange(new Set());
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
          {campaignId
            ? `캠페인: ${campaignLabel ?? (campaignsLoaded ? campaignId : "불러오는 중…")}`
            : "+ 캠페인"}
          {campaignId && (
            <span
              className="apl-popover__btn"
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

        <button
          ref={mediaBtnRef}
          type="button"
          className={`apl-filter ${mediaFilter.size > 0 ? "apl-filter--active" : ""}`}
          onClick={() => openPopover("media")}
        >
          {mediaFilter.size > 0
            ? `매체: ${Array.from(mediaFilter)
                .map((media) => MEDIA_META[media].label)
                .join(", ")}`
            : "+ 매체"}
          {mediaFilter.size > 0 && (
            <span
              className="apl-popover__btn"
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

        {showStageFilter && (
          <button
            ref={stageBtnRef}
            type="button"
            className={`apl-filter ${stageFilter.size > 0 ? "apl-filter--active" : ""}`}
            onClick={() => openPopover("stage")}
          >
            {stageFilter.size > 0
              ? `상태: ${STAGE_OPTIONS.filter((option) =>
                  stageFilter.has(option.key),
                )
                  .map((option) => option.label)
                  .join(", ")}`
              : "+ 상태"}
            {stageFilter.size > 0 && (
              <span
                className="apl-popover__btn"
                onClick={(event) => {
                  event.stopPropagation();
                  clear("stage");
                  setPopover(null);
                }}
              >
                {" "}
                ✕
              </span>
            )}
          </button>
        )}
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
                    {campaignOptions.map((campaign) => {
                      const selected = campaign.id === campaignId;
                      return (
                        <button
                          key={campaign.id}
                          type="button"
                          className={`apl-popover__option${
                            selected ? " apl-popover__option--on" : ""
                          }`}
                          onClick={() => {
                            onCampaignChange(campaign.id);
                            setPopover(null);
                          }}
                        >
                          <span className="apl-popover__option-label">
                            {campaign.title}
                          </span>
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
            ) : popover.kind === "stage" ? (
              <>
                <div className="apl-popover__title">상태 선택 (복수 가능)</div>
                <div className="apl-popover__items">
                  {STAGE_OPTIONS.map((option) => {
                    const selected = stageFilter.has(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`apl-popover__option${
                          selected ? " apl-popover__option--on" : ""
                        }`}
                        onClick={() => toggleStage(option.key)}
                      >
                        <span className="apl-popover__option-label">
                          {option.label}
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
            ) : popover.kind === "media" ? (
              <>
                <div className="apl-popover__title">매체 선택 (복수 가능)</div>
                <div className="apl-popover__items">
                  {(Object.keys(MEDIA_META) as Media[]).map((media) => {
                    const selected = mediaFilter.has(media);
                    return (
                      <button
                        key={media}
                        type="button"
                        className={`apl-popover__option${
                          selected ? " apl-popover__option--on" : ""
                        }`}
                        onClick={() => toggleMedia(media)}
                      >
                        <i
                          className={`${MEDIA_META[media].icon} apl-popover__option-icon`}
                        />
                        <span className="apl-popover__option-label">
                          {MEDIA_META[media].label}
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
                    onChange={(event) => setMinFollowersDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
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
