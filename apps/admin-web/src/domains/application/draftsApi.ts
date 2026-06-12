import {
  AdminSettlementListResponseSchema,
  AdminSubmittedPostListResponseSchema,
  AdminSubmittedPostSchema,
  type AdminSettlement,
  type AdminSubmittedPost,
} from "@jsure/shared";
import { api } from "@/lib/api";

export async function listSubmittedPosts(): Promise<AdminSubmittedPost[]> {
  const res = await api.get("/campaign-applications/submitted-posts");
  return AdminSubmittedPostListResponseSchema.parse(res.data).posts;
}

export async function approveSubmittedPost(
  postId: string,
): Promise<AdminSubmittedPost> {
  const res = await api.post(
    `/campaign-applications/submitted-posts/${encodeURIComponent(postId)}/approve`,
  );
  return AdminSubmittedPostSchema.parse(res.data);
}

export async function rejectSubmittedPost(
  postId: string,
  comment: string,
): Promise<AdminSubmittedPost> {
  const res = await api.post(
    `/campaign-applications/submitted-posts/${encodeURIComponent(postId)}/reject`,
    { comment },
  );
  return AdminSubmittedPostSchema.parse(res.data);
}

export async function undoSubmittedPostReview(
  postId: string,
): Promise<AdminSubmittedPost> {
  const res = await api.post(
    `/campaign-applications/submitted-posts/${encodeURIComponent(postId)}/undo`,
  );
  return AdminSubmittedPostSchema.parse(res.data);
}

export async function settleSubmittedPost(
  postId: string,
): Promise<AdminSubmittedPost> {
  const res = await api.post(
    `/campaign-applications/submitted-posts/${encodeURIComponent(postId)}/settle`,
  );
  return AdminSubmittedPostSchema.parse(res.data);
}

export async function listSettlements(
  month?: string,
): Promise<AdminSettlement[]> {
  const res = await api.get("/campaign-applications/settlements", {
    params: month ? { month } : undefined,
  });
  return AdminSettlementListResponseSchema.parse(res.data).settlements;
}

export async function completeSettlements(
  ids?: string[],
): Promise<{ completedCount: number }> {
  const res = await api.post("/campaign-applications/settlements/complete", {
    ids: ids ?? [],
  });
  return res.data as { completedCount: number };
}

export async function fetchPendingSettlementCount(): Promise<number> {
  const res = await api.get("/campaign-applications/settlements/pending-count");
  return (res.data as { count: number }).count;
}
