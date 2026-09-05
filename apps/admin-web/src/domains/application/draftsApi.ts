import {
  AdminSettlementListResponseSchema,
  AdminSubmissionListResponseSchema,
  AdminSubmissionSchema,
  AttachmentListResponseSchema,
  type AdminSettlement,
  type AdminSubmission,
  type AdminUpdateInsightRequest,
  type Attachment,
} from "@jsure/shared";
import { api } from "@/lib/api";

export async function listSubmissions(): Promise<AdminSubmission[]> {
  const res = await api.get("/campaign-applications/submissions");
  return AdminSubmissionListResponseSchema.parse(res.data).submissions;
}

export async function fetchSubmittedPostAttachments(
  postId: string,
): Promise<Attachment[]> {
  const res = await api.get(
    `/campaign-applications/submitted-posts/${encodeURIComponent(postId)}/attachments`,
  );
  return AttachmentListResponseSchema.parse(res.data).attachments;
}

export async function fetchSubmission(
  applicationId: string,
): Promise<AdminSubmission> {
  const res = await api.get(
    `/campaign-applications/${encodeURIComponent(applicationId)}/submission`,
  );
  return AdminSubmissionSchema.parse(res.data);
}

export async function fetchApplicationAttachments(
  applicationId: string,
): Promise<Attachment[]> {
  const res = await api.get(
    `/campaign-applications/${encodeURIComponent(applicationId)}/attachments`,
  );
  return AttachmentListResponseSchema.parse(res.data).attachments;
}

export async function approveSubmission(
  applicationId: string,
): Promise<AdminSubmission> {
  const res = await api.post(
    `/campaign-applications/${encodeURIComponent(applicationId)}/submission/approve`,
  );
  return AdminSubmissionSchema.parse(res.data);
}

export async function rejectSubmission(
  applicationId: string,
  comment: string,
): Promise<AdminSubmission> {
  const res = await api.post(
    `/campaign-applications/${encodeURIComponent(applicationId)}/submission/reject`,
    { comment },
  );
  return AdminSubmissionSchema.parse(res.data);
}

export async function undoSubmissionReview(
  applicationId: string,
): Promise<AdminSubmission> {
  const res = await api.post(
    `/campaign-applications/${encodeURIComponent(applicationId)}/submission/undo`,
  );
  return AdminSubmissionSchema.parse(res.data);
}

export async function settleSubmission(
  applicationId: string,
): Promise<AdminSubmission> {
  const res = await api.post(
    `/campaign-applications/${encodeURIComponent(applicationId)}/submission/settle`,
  );
  return AdminSubmissionSchema.parse(res.data);
}

/** 인사이트 오기입 보정 — 게시물(서브타입) 단위. 응답은 갱신된 응모 제출물 전체. */
export async function updateSubmittedPostInsight(
  postId: string,
  body: AdminUpdateInsightRequest,
): Promise<AdminSubmission> {
  const res = await api.patch(
    `/campaign-applications/submitted-posts/${encodeURIComponent(postId)}/insight`,
    body,
  );
  return AdminSubmissionSchema.parse(res.data);
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

export async function fetchAppliedCount(): Promise<number> {
  const res = await api.get("/campaign-applications/applied-count");
  return (res.data as { count: number }).count;
}

export async function fetchPendingReviewCount(): Promise<number> {
  const res = await api.get("/campaign-applications/submissions/pending-count");
  return (res.data as { count: number }).count;
}
