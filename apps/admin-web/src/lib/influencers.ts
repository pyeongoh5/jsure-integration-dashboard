import {
  AdminInfluencerListResponseSchema,
  type AdminInfluencer,
} from "@jsure/shared";
import { api } from "./api";

export async function listInfluencers(): Promise<AdminInfluencer[]> {
  const res = await api.get("/influencers");
  return AdminInfluencerListResponseSchema.parse(res.data).influencers;
}
