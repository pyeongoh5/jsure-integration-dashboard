import { useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { translate } from "@i18n/admin";
import type { AdminLanguage } from "@i18n/admin";
import { getStoredLanguage } from "@/lib/i18n";
import type { AdminInfluencer, InfluencerFilter } from "@jsure/shared";
import { listInfluencersPage } from "./api";

/** 한 번에 불러오는 인플루언서 수. 무한 스크롤 한 페이지 분량. */
export const INFLUENCERS_PAGE_SIZE = 30;

export type InfluencersLoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export type UseInfluencersDataResult = {
  state: InfluencersLoadState;
  influencers: AdminInfluencer[];
  /** 필터에 걸린 전체 인원수 — 불러온 페이지 수와 무관. */
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  reload: () => void;
};

export const influencersQueryKey = (filter: InfluencerFilter) =>
  ["influencers", filter] as const;

function errorMessage(error: unknown, language: AdminLanguage): string {
  if (error instanceof Error) return error.message;
  return translate("pages.influencers.loadFailed", language);
}

function toLoadState(
  isPending: boolean,
  isError: boolean,
  error: unknown,
): InfluencersLoadState {
  if (isPending) return { kind: "loading" };
  if (isError) {
    return { kind: "error", message: errorMessage(error, getStoredLanguage()) };
  }
  return { kind: "ready" };
}

/** 인플루언서 목록 — 필터는 서버가 적용하고, 여기서는 커서로 이어붙이기만 한다. */
export function useInfluencersData(
  filter: InfluencerFilter,
): UseInfluencersDataResult {
  const query = useInfiniteQuery({
    queryKey: influencersQueryKey(filter),
    queryFn: ({ pageParam }) =>
      listInfluencersPage(filter, pageParam, INFLUENCERS_PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // 무한 쿼리의 refetch 는 이미 불러온 페이지를 전부 다시 호출한다. 창 포커스마다
    // refetch 하면 여러 페이지까지 스크롤한 뒤 탭을 오갈 때마다 요청이 그만큼 나간다.
    // 목록 갱신은 메모 변경 후 reload() 로 명시적으로 한다.
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;
  // IntersectionObserver 가 매 렌더마다 재등록되지 않도록 안정적인 참조로 넘긴다.
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    state: toLoadState(query.isPending, query.isError, query.error),
    influencers: query.data?.pages.flatMap((page) => page.influencers) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
    hasMore: hasNextPage,
    loadingMore: isFetchingNextPage,
    loadMore,
    reload,
  };
}
