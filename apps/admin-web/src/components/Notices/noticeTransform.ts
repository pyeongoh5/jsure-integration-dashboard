import type { NoticeResponse } from "@jsure/shared";

export type NoticeRow = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  startAtLabel: string;
  endAtLabel: string;
  status: "scheduled" | "active" | "expired";
  authorName: string;
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function toNoticeRow(notice: NoticeResponse, now: Date = new Date()): NoticeRow {
  const start = new Date(notice.startAt);
  const end = new Date(notice.endAt);
  let status: NoticeRow["status"];
  if (start > now) status = "scheduled";
  else if (end <= now) status = "expired";
  else status = "active";
  return {
    id: notice.id,
    title: notice.title,
    startAt: notice.startAt,
    endAt: notice.endAt,
    startAtLabel: formatDateTime(notice.startAt),
    endAtLabel: formatDateTime(notice.endAt),
    status,
    authorName: notice.authorName ?? "—",
  };
}

export function toDateTimeLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const tzOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export function fromDateTimeLocalInputValue(value: string): string {
  return new Date(value).toISOString();
}
