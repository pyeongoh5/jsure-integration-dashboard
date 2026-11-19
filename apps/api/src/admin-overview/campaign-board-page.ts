import {
  CAMPAIGN_BOARD_PAGE_SIZE,
  type AdminCampaignBoardResponse,
  type CampaignBoardFilter,
  type CampaignBoardRow,
  type CampaignStageCounts,
} from "@jsure/shared";

function emptyStageCounts(): CampaignStageCounts {
  return {
    OPEN_PENDING: 0,
    IN_PROGRESS: 0,
    INSIGHT_COLLECTING: 0,
    SETTLEMENT_PENDING: 0,
  };
}

/**
 * 단계 필터·페이지 자르기와 단계별 집계.
 *
 * 입력은 카테고리·검색까지 이미 걸러진 행이다. 단계 카운터는 단계 필터를 빼고
 * 세어야 한다 — 카드를 눌러 목록이 좁혀져도 나머지 단계의 숫자가 0 으로
 * 사라지면 안 되기 때문.
 */
export function paginateCampaignBoard(
  rows: CampaignBoardRow[],
  filter: Pick<CampaignBoardFilter, "stage" | "page">,
): AdminCampaignBoardResponse {
  const stageCounts = emptyStageCounts();
  for (const row of rows) stageCounts[row.stage] += 1;

  const filtered = filter.stage ? rows.filter((row) => row.stage === filter.stage) : rows;

  // 필터로 행이 줄어 요청한 페이지가 사라졌으면 마지막 페이지를 돌려준다.
  const lastPage = Math.max(0, Math.ceil(filtered.length / CAMPAIGN_BOARD_PAGE_SIZE) - 1);
  const page = Math.min(filter.page, lastPage);
  const start = page * CAMPAIGN_BOARD_PAGE_SIZE;

  return {
    rows: filtered.slice(start, start + CAMPAIGN_BOARD_PAGE_SIZE),
    total: filtered.length,
    stageCounts,
  };
}
