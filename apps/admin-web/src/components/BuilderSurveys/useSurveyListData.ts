import { useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { translate } from "@i18n/admin";
import type { AdminLanguage } from "@i18n/admin";
import { extractApiErrorMessage } from "@/lib/api";
import { getStoredLanguage } from "@/lib/i18n";
import type { BuilderSurveyListItem } from "@jsure/shared";
import { listSurveysPage } from "@/domains/builderSurvey";

/** 한 번에 불러오는 앙케이트 수. 무한 스크롤 한 페이지 분량. */
export const SURVEYS_PAGE_SIZE = 30;

export type SurveysLoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export type UseSurveyListDataResult = {
  state: SurveysLoadState;
  surveys: BuilderSurveyListItem[];
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  reload: () => void;
};

const surveysQueryKey = ["builderSurveys"] as const;

function errorMessage(error: unknown, language: AdminLanguage): string {
  return extractApiErrorMessage(
    error,
    translate("pages.builderSurveys.loadFailed", language),
  );
}

function toLoadState(
  isPending: boolean,
  isError: boolean,
  error: unknown,
): SurveysLoadState {
  if (isPending) return { kind: "loading" };
  if (isError) {
    return { kind: "error", message: errorMessage(error, getStoredLanguage()) };
  }
  return { kind: "ready" };
}

/** 앙케이트 목록 — 커서로 이어붙이는 무한 스크롤. */
export function useSurveyListData(): UseSurveyListDataResult {
  const query = useInfiniteQuery({
    queryKey: surveysQueryKey,
    queryFn: ({ pageParam }) => listSurveysPage(pageParam, SURVEYS_PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
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
    surveys: query.data?.pages.flatMap((page) => page.items) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
    hasMore: hasNextPage,
    loadingMore: isFetchingNextPage,
    loadMore,
    reload,
  };
}
