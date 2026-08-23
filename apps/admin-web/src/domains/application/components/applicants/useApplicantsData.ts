import { useCallback, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { translate, type AdminLanguage } from "@i18n/admin";
import { getStoredLanguage, useLanguage } from "@/lib/i18n";
import type { AdminApplication, ApplicantFilter } from "@jsure/shared";
import { listApplicantsPage } from "../api";
import { toApplicant } from "./applicantTransform";
import type { Applicant } from "./types";

/** 한 번에 불러오는 응모 수. 무한 스크롤 한 페이지 분량. */
export const APPLICANTS_PAGE_SIZE = 30;

export type ApplicantsLoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export type UseApplicantsDataResult = {
  state: ApplicantsLoadState;
  applicants: Applicant[];
  /** 필터에 걸린 전체 건수 — 불러온 페이지 수와 무관. */
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  reload: () => void;
};

export const applicantsQueryKey = (filter: ApplicantFilter) =>
  ["applicants", filter] as const;

function errorMessage(error: unknown, language: AdminLanguage): string {
  if (error instanceof Error) return error.message;
  return translate(
    "domains.application.applicants.errors.loadFailed",
    language,
  );
}

function toLoadState(
  isPending: boolean,
  isError: boolean,
  error: unknown,
): ApplicantsLoadState {
  if (isPending) return { kind: "loading" };
  if (isError) {
    return { kind: "error", message: errorMessage(error, getStoredLanguage()) };
  }
  return { kind: "ready" };
}

/** 응모자 목록 — 필터는 서버가 적용하고, 여기서는 커서로 이어붙이기만 한다. */
export function useApplicantsData(
  filter: ApplicantFilter,
): UseApplicantsDataResult {
  const { language } = useLanguage();
  const query = useInfiniteQuery({
    queryKey: applicantsQueryKey(filter),
    queryFn: ({ pageParam }) =>
      listApplicantsPage(filter, pageParam, APPLICANTS_PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // 상대시각 표기는 렌더 시점 기준. 페이지가 늘어날 때만 다시 계산한다.
  const applicants = useMemo<Applicant[]>(() => {
    const now = new Date();
    const rows: AdminApplication[] =
      query.data?.pages.flatMap((page) => page.applications) ?? [];
    return rows
      .map((application) => toApplicant(application, now, language))
      .filter((applicant): applicant is Applicant => applicant !== null);
  }, [query.data, language]);

  const state = toLoadState(query.isPending, query.isError, query.error);

  // IntersectionObserver 가 매 렌더마다 재등록되지 않도록 안정적인 참조로 넘긴다.
  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    state,
    applicants,
    total: query.data?.pages[0]?.total ?? 0,
    hasMore: hasNextPage,
    loadingMore: isFetchingNextPage,
    loadMore,
    reload,
  };
}
