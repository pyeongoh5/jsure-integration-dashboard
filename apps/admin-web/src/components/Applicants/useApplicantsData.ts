import { useEffect, useMemo, useState } from "react";
import type {
  AdminApplication,
  ApplicationStatus,
} from "@jsure/shared";
import {
  getApplicationCounts,
  listApplications,
} from "@/lib/applications";
import type { Applicant, ApplicantStatus, StatusCounts } from "./types";
import {
  TAB_TO_STATUSES,
  aggregateTabCounts,
  toApplicant,
} from "./applicantTransform";

export type ApplicantsLoadState =
  | { kind: "loading" }
  | { kind: "ready"; rows: AdminApplication[] }
  | { kind: "error"; message: string };

export type UseApplicantsDataResult = {
  state: ApplicantsLoadState;
  applicants: Applicant[];
  counts: StatusCounts;
  reload: () => void;
};

export function useApplicantsData(
  campaignId: string | null,
  tab: ApplicantStatus,
): UseApplicantsDataResult {
  const [state, setState] = useState<ApplicantsLoadState>({ kind: "loading" });
  const [statusCounts, setStatusCounts] = useState<Record<
    ApplicationStatus,
    number
  > | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getApplicationCounts(campaignId ?? undefined)
      .then((c) => {
        if (!cancelled) setStatusCounts(c);
      })
      .catch(() => {
        if (!cancelled) setStatusCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    listApplications({
      campaignId: campaignId ?? undefined,
      statuses: TAB_TO_STATUSES[tab],
    })
      .then((rows) => {
        if (!cancelled) setState({ kind: "ready", rows });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : "응모자 목록을 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, tab, reloadKey]);

  const now = useMemo(() => new Date(), [state]);

  const applicants = useMemo<Applicant[]>(() => {
    if (state.kind !== "ready") return [];
    return state.rows.map((a) => toApplicant(a, now));
  }, [state, now]);

  const counts = useMemo(() => aggregateTabCounts(statusCounts), [statusCounts]);

  return {
    state,
    applicants,
    counts,
    reload: () => setReloadKey((k) => k + 1),
  };
}
