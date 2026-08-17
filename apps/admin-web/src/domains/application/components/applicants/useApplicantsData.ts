import { useEffect, useMemo, useState } from "react";
import { translate } from "@i18n/admin";
import { getStoredLanguage, useLanguage } from "@/lib/i18n";
import type { AdminApplication } from "@jsure/shared";
import { listApplications } from "../api";
import { toApplicant } from "./applicantTransform";
import type { Applicant } from "./types";

export type ApplicantsLoadState =
  | { kind: "loading" }
  | { kind: "ready"; rows: AdminApplication[] }
  | { kind: "error"; message: string };

export type UseApplicantsDataResult = {
  state: ApplicantsLoadState;
  applicants: Applicant[];
  reload: () => void;
};

export function useApplicantsData(
  campaignId: string | null,
): UseApplicantsDataResult {
  const { language } = useLanguage();
  const [state, setState] = useState<ApplicantsLoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    listApplications({ campaignId: campaignId ?? undefined })
      .then((rows) => {
        if (!cancelled) setState({ kind: "ready", rows });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : translate(
                  "domains.application.applicants.errors.loadFailed",
                  getStoredLanguage(),
                ),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, reloadKey]);

  const now = useMemo(() => new Date(), [state]);

  const applicants = useMemo<Applicant[]>(() => {
    if (state.kind !== "ready") return [];
    return state.rows
      .map((application) => toApplicant(application, now, language))
      .filter((applicant): applicant is Applicant => applicant !== null);
  }, [state, now, language]);

  return {
    state,
    applicants,
    reload: () => setReloadKey((current) => current + 1),
  };
}
