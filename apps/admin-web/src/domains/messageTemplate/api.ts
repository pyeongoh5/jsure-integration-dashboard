import {
  LineMessageTemplateDetailResponseSchema,
  LineMessageTemplateListResponseSchema,
  LineMessageTemplateResponseSchema,
  PreviewLineMessageTemplateResponseSchema,
  TestSendLineMessageTemplateResponseSchema,
  type CampaignCategory,
  type LineMessageTemplateDetailResponse,
  type LineMessageTemplateListResponse,
  type LineMessageTemplateResponse,
  type LineTriggerKey,
  type PreviewLineMessageTemplateResponse,
  type TestSendLineMessageTemplateResponse,
  type UpdateLineMessageTemplateRequest,
} from "@jsure/shared";
import { api } from "@/lib/api";

function pathOf(category: CampaignCategory, triggerKey: LineTriggerKey): string {
  return `/admin/line-templates/${category}/${triggerKey}`;
}

export async function listTemplates(
  category: CampaignCategory,
): Promise<LineMessageTemplateListResponse> {
  const res = await api.get("/admin/line-templates", { params: { category } });
  return LineMessageTemplateListResponseSchema.parse(res.data);
}

export async function getTemplate(
  category: CampaignCategory,
  triggerKey: LineTriggerKey,
): Promise<LineMessageTemplateDetailResponse> {
  const res = await api.get(pathOf(category, triggerKey));
  return LineMessageTemplateDetailResponseSchema.parse(res.data);
}

export async function updateTemplate(
  category: CampaignCategory,
  triggerKey: LineTriggerKey,
  input: UpdateLineMessageTemplateRequest,
): Promise<LineMessageTemplateResponse> {
  const res = await api.put(pathOf(category, triggerKey), input);
  return LineMessageTemplateResponseSchema.parse(res.data);
}

export async function previewTemplate(
  category: CampaignCategory,
  triggerKey: LineTriggerKey,
  body: string,
): Promise<PreviewLineMessageTemplateResponse> {
  const res = await api.post(`${pathOf(category, triggerKey)}/preview`, { body });
  return PreviewLineMessageTemplateResponseSchema.parse(res.data);
}

export async function testSendTemplate(
  category: CampaignCategory,
  triggerKey: LineTriggerKey,
  body: string,
): Promise<TestSendLineMessageTemplateResponse> {
  const res = await api.post(`${pathOf(category, triggerKey)}/test-send`, { body });
  return TestSendLineMessageTemplateResponseSchema.parse(res.data);
}

export async function setTemplateEnabled(
  category: CampaignCategory,
  triggerKey: LineTriggerKey,
  enabled: boolean,
): Promise<LineMessageTemplateResponse> {
  const res = await api.patch(`${pathOf(category, triggerKey)}/enabled`, { enabled });
  return LineMessageTemplateResponseSchema.parse(res.data);
}

export async function updateAdminTestLineUserId(
  testLineUserId: string | null,
): Promise<{ testLineUserId: string | null }> {
  const res = await api.patch("/admin/me/test-line-user-id", { testLineUserId });
  return res.data as { testLineUserId: string | null };
}
