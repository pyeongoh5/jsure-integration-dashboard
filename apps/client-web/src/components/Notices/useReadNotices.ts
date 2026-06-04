import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "client-web:readNoticeIds";
const STORAGE_EVENT = "client-web:readNoticeIds:changed";

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

let cache: string[] = readIds();

function emit() {
  cache = readIds();
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(STORAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): string[] {
  return cache;
}

function getServerSnapshot(): string[] {
  return [];
}

export function useReadNoticeIds(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useMarkNoticeRead() {
  return useCallback((id: string) => {
    const current = readIds();
    if (current.includes(id)) return;
    const next = [...current, id];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emit();
  }, []);
}
