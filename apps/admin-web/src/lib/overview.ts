import {
  AdminOverviewResponseSchema,
  type AdminOverviewResponse,
} from "@jsure/shared";
import { api } from "./api";

export async function getOverviewStats(): Promise<AdminOverviewResponse> {
  const res = await api.get("/admin/overview");
  return AdminOverviewResponseSchema.parse(res.data);
}
