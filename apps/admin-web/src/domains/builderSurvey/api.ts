import {
  BuilderSurveyPageResponseSchema,
  BuilderSurveyResponseSchema,
  type BuilderSurveyPageResponse,
  type BuilderSurveyResponse,
  type CreateBuilderSurveyRequest,
  type UpdateBuilderSurveyRequest,
} from "@jsure/shared";
import { builderApi } from "@/lib/api";

/** 앙케이트 목록 한 페이지 — 커서 페이징, 정렬·필터는 서버가 맡는다. */
export async function listSurveysPage(
  cursor: string | null,
  limit: number,
  query?: string,
): Promise<BuilderSurveyPageResponse> {
  const search = new URLSearchParams();
  search.set("limit", String(limit));
  if (cursor) search.set("cursor", cursor);
  if (query) search.set("q", query);
  const res = await builderApi.get(`/admin/builder/surveys?${search}`);
  return BuilderSurveyPageResponseSchema.parse(res.data);
}

export async function fetchSurvey(id: string): Promise<BuilderSurveyResponse> {
  const res = await builderApi.get(
    `/admin/builder/surveys/${encodeURIComponent(id)}`,
  );
  return BuilderSurveyResponseSchema.parse(res.data);
}

export async function createSurvey(
  body: CreateBuilderSurveyRequest,
): Promise<BuilderSurveyResponse> {
  const res = await builderApi.post("/admin/builder/surveys", body);
  return BuilderSurveyResponseSchema.parse(res.data);
}

export async function updateSurvey(
  id: string,
  body: UpdateBuilderSurveyRequest,
): Promise<BuilderSurveyResponse> {
  const res = await builderApi.put(
    `/admin/builder/surveys/${encodeURIComponent(id)}`,
    body,
  );
  return BuilderSurveyResponseSchema.parse(res.data);
}

/** 소프트 삭제 — 서버가 204 를 돌려준다. */
export async function deleteSurvey(id: string): Promise<void> {
  await builderApi.delete(`/admin/builder/surveys/${encodeURIComponent(id)}`);
}
