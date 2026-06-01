import {
  AdminSubmittedPostListResponseSchema,
  AdminSubmittedPostSchema,
  type AdminSubmittedPost,
} from "@jsure/shared";
import { api } from "./api";

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
