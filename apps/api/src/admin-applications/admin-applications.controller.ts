import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApplicationStatusSchema,
  type AdminApplicationListResponse,
  type ApplicationStatus,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminApplicationsService } from "./admin-applications.service";

@UseGuards(JwtAuthGuard)
@Controller("campaign-applications")
export class AdminApplicationsController {
  constructor(private readonly svc: AdminApplicationsService) {}

  @Get()
  async list(
    @Query("campaignId") campaignId?: string,
    @Query("status") status?: string | string[],
  ): Promise<AdminApplicationListResponse> {
    const statuses = parseStatuses(status);
    const applications = await this.svc.list({
      campaignId: campaignId || undefined,
      statuses,
    });
    return { applications };
  }
}

function parseStatuses(raw: string | string[] | undefined): ApplicationStatus[] | undefined {
  if (raw === undefined) return undefined;
  const list = Array.isArray(raw) ? raw : raw.split(",");
  const out: ApplicationStatus[] = [];
  for (const s of list) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    const parsed = ApplicationStatusSchema.safeParse(trimmed);
    if (parsed.success) out.push(parsed.data);
  }
  return out.length > 0 ? out : undefined;
}
