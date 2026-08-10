import {
  ApplicationActivityResponseSchema,
  type AdminActivityLog,
} from "@jsure/shared";
import { api } from "@/lib/api";

export async function fetchApplicationActivity(
  applicationId: string,
): Promise<AdminActivityLog[]> {
  const res = await api.get(
    `/campaign-applications/${encodeURIComponent(applicationId)}/activity`,
  );
  return ApplicationActivityResponseSchema.parse(res.data).items;
}
