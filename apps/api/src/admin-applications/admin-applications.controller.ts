import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApplicationStatusSchema,
  RejectApplicationRequestSchema,
  type AdminApplication,
  type AdminApplicationCountsResponse,
  type AdminApplicationListResponse,
  type ApplicationStatus,
  type RejectApplicationRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
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

  @Get("counts")
  async counts(
    @Query("campaignId") campaignId?: string,
  ): Promise<AdminApplicationCountsResponse> {
    const counts = await this.svc.counts(campaignId || undefined);
    return { counts };
  }

  @Post(":id/approve")
  @HttpCode(200)
  approve(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminApplication> {
    return this.svc.approve(id, req.user.id);
  }

  @Post(":id/reject")
  @HttpCode(200)
  reject(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RejectApplicationRequestSchema))
    body: RejectApplicationRequest,
  ): Promise<AdminApplication> {
    return this.svc.reject(id, req.user.id, body.reason);
  }

  @Post(":id/undo")
  @HttpCode(200)
  undo(@Param("id") id: string): Promise<AdminApplication> {
    return this.svc.undo(id);
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
