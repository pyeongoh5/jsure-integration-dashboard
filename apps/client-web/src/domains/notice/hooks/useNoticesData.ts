import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { InfluencerNoticeListItem } from "@jsure/shared";
import { listNotices } from "../api";

type Snapshot = {
  notices: InfluencerNoticeListItem[];
  loading: boolean;
  error: string | null;
};

const EVENT = "client-web:notices:changed";
let snapshot: Snapshot = { notices: [], loading: false, error: null };
let inflight: Promise<void> | null = null;
let lastFetchAt = 0;

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

function setSnapshot(next: Snapshot) {
  snapshot = next;
  emit();
}

async function refresh(): Promise<void> {
  if (inflight) return inflight;
  setSnapshot({ ...snapshot, loading: true, error: null });
  inflight = (async () => {
    try {
      const notices = await listNotices();
      lastFetchAt = Date.now();
      setSnapshot({ notices, loading: false, error: null });
    } catch (error) {
      setSnapshot({
        notices: snapshot.notices,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "공지사항을 불러올 수 없습니다",
      });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function getServerSnapshot(): Snapshot {
  return { notices: [], loading: false, error: null };
}

const STALE_MS = 30_000;

export function useNoticesData() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (lastFetchAt === 0 || Date.now() - lastFetchAt > STALE_MS) {
      void refresh();
    }
  }, []);

  const reload = useCallback(() => refresh(), []);

  return { ...value, reload };
}
