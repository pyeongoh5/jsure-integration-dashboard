import {
  InfluencerNoticeDetailSchema,
  InfluencerNoticeListResponseSchema,
  type InfluencerNoticeDetail,
  type InfluencerNoticeListItem,
} from "@jsure/shared";
import { api } from "../api";

export async function listNotices(): Promise<InfluencerNoticeListItem[]> {
  const res = await api.get("/influencer/notices");
  return InfluencerNoticeListResponseSchema.parse(res.data).items;
}

export async function getNotice(id: string): Promise<InfluencerNoticeDetail> {
  const res = await api.get(`/influencer/notices/${encodeURIComponent(id)}`);
  return InfluencerNoticeDetailSchema.parse(res.data);
}
