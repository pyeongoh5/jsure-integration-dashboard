import {
  BroadcastJobListResponseSchema,
  BroadcastJobSchema,
  BroadcastMessageResponseSchema,
  type BroadcastJob,
  type BroadcastMessageRequest,
  type BroadcastMessageResponse,
} from "@jsure/shared";
import { api } from "./api";

export async function sendBroadcastMessage(
  input: BroadcastMessageRequest,
): Promise<BroadcastMessageResponse> {
  const res = await api.post("/admin/broadcasts", input);
  return BroadcastMessageResponseSchema.parse(res.data);
}

export async function getBroadcastJob(id: string): Promise<BroadcastJob> {
  const res = await api.get(`/admin/broadcasts/${encodeURIComponent(id)}`);
  return BroadcastJobSchema.parse(res.data);
}

export async function listBroadcastJobs(): Promise<BroadcastJob[]> {
  const res = await api.get("/admin/broadcasts");
  return BroadcastJobListResponseSchema.parse(res.data).jobs;
}
