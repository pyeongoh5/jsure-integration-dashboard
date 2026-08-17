import { useEffect, useState } from "react";
import type { AdminActivityLog } from "@jsure/shared";
import { translate } from "@i18n/admin";
import { getStoredLanguage } from "@/lib/i18n";
import { fetchApplicationActivity } from "../../activityApi";

export type ActivityState =
  | { kind: "loading" }
  | { kind: "ready"; items: AdminActivityLog[] }
  | { kind: "error"; message: string };

export function useApplicationActivity(applicationId: string): {
  state: ActivityState;
} {
  const [state, setState] = useState<ActivityState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchApplicationActivity(applicationId)
      .then((items) => {
        if (!cancelled) setState({ kind: "ready", items });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : translate(
                  "domains.application.history.loadFailed",
                  getStoredLanguage(),
                ),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  return { state };
}
