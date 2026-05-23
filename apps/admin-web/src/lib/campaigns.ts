import {
  CampaignResponseSchema,
  type CampaignResponse,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
} from "@jsure/shared";
import { api } from "./api";

export async function getCampaign(id: string): Promise<CampaignResponse> {
  const res = await api.get(`/campaigns/${encodeURIComponent(id)}`);
  return CampaignResponseSchema.parse(res.data);
}

export async function createCampaign(
  input: CreateCampaignRequest,
): Promise<CampaignResponse> {
  const res = await api.post("/campaigns", input);
  return CampaignResponseSchema.parse(res.data);
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignRequest,
): Promise<CampaignResponse> {
  const res = await api.patch(
    `/campaigns/${encodeURIComponent(id)}`,
    input,
  );
  return CampaignResponseSchema.parse(res.data);
}

export async function closeCampaign(id: string): Promise<CampaignResponse> {
  const res = await api.post(`/campaigns/${encodeURIComponent(id)}/close`);
  return CampaignResponseSchema.parse(res.data);
}
