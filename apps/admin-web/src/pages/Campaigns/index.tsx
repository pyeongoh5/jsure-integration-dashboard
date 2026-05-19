import { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "../../ui/Card";
import { FilterChips } from "../../ui/FilterChips";
import { CampaignCardTitle } from "../../components/Campaign/CampaignCardTitle";
import { CampaignCardBody } from "../../components/Campaign/CampaignCardBody";
import { CampaignCardFooter } from "../../components/Campaign/CampaignCardFooter";
import type { Campaign, CampaignStatus } from "../../components/Campaign/types";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import "./Campaigns.css";
import "../../components/Campaign/CampaignForm.css";

type FilterKey = "all" | CampaignStatus;

const FILTERS: readonly { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "recruit", label: "모집중" },
  { key: "review", label: "검토중" },
  { key: "progress", label: "진행중" },
  { key: "done", label: "완료" },
];

const STATUS_PARAM = "status";

function isFilterKey(value: string | null): value is FilterKey {
  return (
    value === "all" ||
    value === "recruit" ||
    value === "review" ||
    value === "progress" ||
    value === "done"
  );
}

const CAMPAIGNS: Campaign[] = [
  {
    id: "cmp_001",
    brand: "스타벅스",
    name: "프라푸치노 서머 캠페인",
    description: "여름 한정 신메뉴 프라푸치노를 즐기는 일상을 인스타그램 릴스로 공유해 주세요.",
    status: "recruit",
    thumbIcon: "☕",
    period: "5/1 — 6/15",
    reward: "₩300,000 + 제품 제공",
    applied: 27,
    capacity: 30,
    dday: 7,
  },
  {
    id: "cmp_002",
    brand: "비오데르마",
    name: "센시비오 H2O 200ml 리뷰",
    description: "민감성 피부를 위한 클렌징 워터 사용 후기를 블로그 포스팅으로 작성.",
    status: "review",
    thumbIcon: "💧",
    period: "4/20 — 5/20",
    reward: "₩150,000 + 제품 제공",
    applied: 42,
    capacity: 40,
    dday: 3,
  },
  {
    id: "cmp_003",
    brand: "라이프스토어",
    name: "그린 프로젝트 — 친환경 라이프",
    description: "지속 가능한 일상 아이템을 소개하고 친환경 챌린지에 동참합니다.",
    status: "progress",
    thumbIcon: "🌿",
    period: "4/1 — 5/31",
    reward: "₩500,000",
    applied: 12,
    capacity: 12,
    dday: 18,
  },
  {
    id: "cmp_004",
    brand: "대한항공",
    name: "호놀룰루 여행 캠페인",
    description: "하와이 호놀룰루 여행 콘텐츠를 유튜브 영상으로 제작.",
    status: "done",
    thumbIcon: "✈",
    period: "2/1 — 4/30",
    reward: "왕복 항공권 + ₩1,000,000",
    applied: 8,
    capacity: 8,
    dday: 0,
  },
  {
    id: "cmp_005",
    brand: "올리브영",
    name: "5월 어워즈 베스트 픽",
    description: "월간 베스트 아이템을 골라 30초 숏폼으로 제작.",
    status: "recruit",
    thumbIcon: "🛍",
    period: "5/5 — 5/30",
    reward: "₩200,000 + 베스트 키트",
    applied: 18,
    capacity: 50,
    dday: 21,
  },
  {
    id: "cmp_006",
    brand: "무신사",
    name: "썸머 룩북 캠페인",
    description: "여름 신상 컬렉션을 활용한 데일리 룩북을 인스타그램 피드로 게시.",
    status: "recruit",
    thumbIcon: "👕",
    period: "5/10 — 6/10",
    reward: "₩400,000 + 의류 제공",
    applied: 9,
    capacity: 25,
    dday: 5,
  },
];

export function Campaigns() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStatus = searchParams.get(STATUS_PARAM);
  const filter: FilterKey = isFilterKey(rawStatus) ? rawStatus : "all";

  const setFilter = (key: FilterKey) => {
    const next = new URLSearchParams(searchParams);
    if (key === "all") next.delete(STATUS_PARAM);
    else next.set(STATUS_PARAM, key);
    setSearchParams(next);
  };

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return CAMPAIGNS.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (q && !`${c.brand} ${c.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filter, debouncedQuery]);

  return (
    <div className="cmp">
      <div className="cmp__header">
        <div>
          <h1 className="cmp__title">캠페인 관리</h1>
          <p className="cmp__subtitle">전체 캠페인의 상태와 진행 현황을 한눈에 확인하세요.</p>
        </div>
        <button
          type="button"
          className="cf__btn"
          onClick={() => navigate("/campaigns/new")}
        >
          캠페인 만들기
        </button>
      </div>

      <div className="cmp__toolbar">
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <div className="cmp__search">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            placeholder="브랜드 또는 캠페인 이름 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="cmp__empty">조건에 맞는 캠페인이 없습니다.</div>
      ) : (
        <div className="cmp__list">
          {filtered.map((c) => (
            <Card
              key={c.id}
              title={<CampaignCardTitle brand={c.brand} status={c.status} />}
              content={
                <CampaignCardBody
                  thumbIcon={c.thumbIcon}
                  name={c.name}
                  description={c.description}
                  period={c.period}
                  reward={c.reward}
                />
              }
              bottomAffix={
                <CampaignCardFooter
                  applied={c.applied}
                  capacity={c.capacity}
                  dday={c.dday}
                  status={c.status}
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
