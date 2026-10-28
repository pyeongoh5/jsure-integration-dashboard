import { useCallback, useMemo } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import type {
  AdminSubmission,
  AdminSubmissionPageResponse,
  SubmissionFilter,
} from "@jsure/shared";
import { translate, type AdminLanguage } from "@i18n/admin";
import { getStoredLanguage, useLanguage } from "@/lib/i18n";
import { listSubmissionsPage } from "../draftsApi";
import { toDraftReview } from "./draftTransform";
import type { DraftReview } from "./types";

/** 한 번에 불러오는 제출물 수. 무한 스크롤 한 페이지 분량. */
export const DRAFTS_PAGE_SIZE = 30;

export type DraftReviewsLoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export type UseDraftReviewsDataResult = {
  state: DraftReviewsLoadState;
  drafts: DraftReview[];
  /** 필터에 걸린 전체 건수 — 불러온 페이지 수와 무관. */
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  reload: () => void;
  /**
   * 메모 팝업에서 바꾼 관리자 태그를 목록에 즉시 반영한다. 목록을 다시 부르지
   * 않고 캐시의 해당 행만 갈아끼우므로 표가 깜빡이지 않는다.
   */
  patchInfluencerTags: (influencerId: string, tags: string[]) => void;
};

export const draftsQueryKey = (filter: SubmissionFilter) =>
  ["submissions", filter] as const;

function errorMessage(error: unknown, language: AdminLanguage): string {
  if (error instanceof Error) return error.message;
  return translate("domains.application.drafts.errors.loadFailed", language);
}

/** 제출물 검토 목록 — 필터는 서버가 적용하고, 여기서는 커서로 이어붙이기만 한다. */
export function useDraftReviewsData(
  filter: SubmissionFilter,
): UseDraftReviewsDataResult {
  const { language } = useLanguage();
  const query = useInfiniteQuery({
    queryKey: draftsQueryKey(filter),
    queryFn: ({ pageParam }) =>
      listSubmissionsPage(filter, pageParam, DRAFTS_PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // 무한 쿼리의 refetch 는 이미 불러온 페이지를 전부 다시 호출한다. 목록 갱신은
    // 승인·반려 후 reload() 로 명시적으로 하므로 포커스 refetch 는 끈다.
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  // 상대시각 표기는 렌더 시점 기준. 페이지가 늘어날 때만 다시 계산한다.
  const drafts = useMemo<DraftReview[]>(() => {
    const now = new Date();
    const rows: AdminSubmission[] =
      query.data?.pages.flatMap((page) => page.submissions) ?? [];
    return rows.map((submission) => toDraftReview(submission, now, language));
  }, [query.data, language]);

  const state: DraftReviewsLoadState = query.isPending
    ? { kind: "loading" }
    : query.isError
      ? { kind: "error", message: errorMessage(query.error, getStoredLanguage()) }
      : { kind: "ready" };

  // IntersectionObserver 가 매 렌더마다 재등록되지 않도록 안정적인 참조로 넘긴다.
  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  const queryClient = useQueryClient();
  const patchInfluencerTags = useCallback(
    (influencerId: string, tags: string[]) => {
      queryClient.setQueryData<InfiniteData<AdminSubmissionPageResponse>>(
        draftsQueryKey(filter),
        (current) =>
          current && {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              submissions: page.submissions.map((submission) =>
                submission.influencer.id === influencerId
                  ? {
                      ...submission,
                      influencer: { ...submission.influencer, tags },
                    }
                  : submission,
              ),
            })),
          },
      );
    },
    [queryClient, filter],
  );

  return {
    state,
    drafts,
    total: query.data?.pages[0]?.total ?? 0,
    hasMore: hasNextPage,
    loadingMore: isFetchingNextPage,
    loadMore,
    reload,
    patchInfluencerTags,
  };
}
