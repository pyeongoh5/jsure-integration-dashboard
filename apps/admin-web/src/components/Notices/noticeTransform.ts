import type { NoticeResponse } from "@jsure/shared";

export type NoticeRow = {
  id: string;
  title: string;
  publishedAt: string;
  publishedAtLabel: string;
  status: "scheduled" | "published";
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
  const publishedAt = new Date(notice.publishedAt);
  return {
    id: notice.id,
    title: notice.title,
    publishedAt: notice.publishedAt,
    publishedAtLabel: formatDateTime(notice.publishedAt),
    status: publishedAt > now ? "scheduled" : "published",
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
