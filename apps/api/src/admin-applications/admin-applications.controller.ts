import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  AdminUpdateInsightRequestSchema,
  ApplicationStatusSchema,
  parseApplicantFilterParams,
  RejectApplicationRequestSchema,
  RejectSubmissionRequestSchema,
  ShipApplicationRequestSchema,
  type AdminApplicantPageResponse,
  type AdminApplication,
  type AdminApplicationCountsResponse,
  type ApplicantExportResponse,
  type ApplicationActivityResponse,
  type AdminApplicationListResponse,
  type AdminSubmission,
  type AdminSettlementListResponse,
  type AdminSubmissionListResponse,
  type AdminUpdateInsightRequest,
  type ApprovedApplicantExportResponse,
  type AttachmentListResponse,
  type ApplicationStatus,
  type RejectApplicationRequest,
  type RejectSubmissionRequest,
  type ShipApplicationRequest,
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

  @Get("submissions")
  async submissions(): Promise<AdminSubmissionListResponse> {
    const submissions = await this.svc.listSubmissions();
    return { submissions };
  }

  @Get("submissions/pending-count")
  pendingReviewCount(): Promise<{ count: number }> {
    return this.svc.pendingReviewCount();
  }

  /**
   * 응모자 관리 목록 — 화면 필터를 그대로 서버에서 적용하고 커서로 페이징한다.
   * 필터 없는 전체 목록(@Get())은 대시보드 통계가 쓰고 있어 그대로 둔다.
   */
  @Get("applicants")
  listApplicants(
    @Query() query: Record<string, string>,
  ): Promise<AdminApplicantPageResponse> {
    const limit = Number(query.limit);
    return this.svc.listApplicantsPage(
      parseApplicantFilterParams(query),
      query.cursor?.trim() || null,
      Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 30,
    );
  }

  /** 응모자 관리 CSV — 목록과 같은 필터에 걸린 응모 전체(현재 페이지가 아니라). */
  @Get("applicants/export")
  exportApplicants(
    @Query() query: Record<string, string>,
  ): Promise<ApplicantExportResponse> {
    return this.svc.exportApplicants(parseApplicantFilterParams(query));
  }

  @Get("export/approved")
  exportApproved(
    @Query("campaignId") campaignId?: string,
  ): Promise<ApprovedApplicantExportResponse> {
    const trimmed = campaignId?.trim();
    if (!trimmed) {
      throw new BadRequestException("campaignId is required");
    }
    return this.svc.exportApprovedApplicants(trimmed);
  }

  @Get(":id/submission")
  getSubmission(@Param("id") id: string): Promise<AdminSubmission> {
    return this.svc.getSubmission(id);
  }

  @Get(":id/activity")
  async activity(
    @Param("id") id: string,
  ): Promise<ApplicationActivityResponse> {
    const items = await this.svc.listActivity(id);
    return { items };
  }

  @Get(":id/attachments")
  async applicationAttachments(
    @Param("id") id: string,
  ): Promise<AttachmentListResponse> {
    const attachments = await this.svc.listApplicationAttachments(id);
    return { attachments };
  }

  @Get("submitted-posts/:postId/attachments")
  async submittedPostAttachments(
    @Param("postId") postId: string,
  ): Promise<AttachmentListResponse> {
    const attachments = await this.svc.listSubmittedPostAttachments(postId);
    return { attachments };
  }

  /** 인사이트 오기입 보정 — 게시물(서브타입) 단위. */
  @Patch("submitted-posts/:postId/insight")
  updateInsight(
    @Req() req: { user: AuthenticatedUser },
    @Param("postId") postId: string,
    @Body(new ZodValidationPipe(AdminUpdateInsightRequestSchema))
    body: AdminUpdateInsightRequest,
  ): Promise<AdminSubmission> {
    return this.svc.updateInsight(postId, body, req.user);
  }

  @Post(":id/submission/approve")
  @HttpCode(200)
  approveSubmission(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminSubmission> {
    return this.svc.approveSubmission(id, req.user);
  }

  @Post(":id/submission/reject")
  @HttpCode(200)
  rejectSubmission(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RejectSubmissionRequestSchema))
    body: RejectSubmissionRequest,
  ): Promise<AdminSubmission> {
    return this.svc.rejectSubmission(id, req.user, body.comment.trim());
  }

  @Post(":id/submission/undo")
  @HttpCode(200)
  undoSubmissionReview(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminSubmission> {
    return this.svc.undoSubmissionReview(id, req.user);
  }

  @Post(":id/submission/settle")
  @HttpCode(200)
  settleSubmission(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminSubmission> {
    return this.svc.settleSubmission(id, req.user);
  }

  @Get("settlements")
  async listSettlements(
    @Query("month") month?: string,
  ): Promise<AdminSettlementListResponse> {
    const settlements = await this.svc.listSettlements(month);
    return { settlements };
  }

  @Get("settlements/pending-count")
  pendingSettlementCount(): Promise<{ count: number }> {
    return this.svc.pendingSettlementCount();
  }

  @Get("applied-count")
  appliedCount(): Promise<{ count: number }> {
    return this.svc.appliedCount();
  }

  @Post("settlements/complete")
  @HttpCode(200)
  completeSettlements(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: { ids?: string[] },
  ): Promise<{ completedCount: number }> {
    return this.svc.completeSettlements(req.user, body.ids);
  }

  @Post(":id/approve")
  @HttpCode(200)
  approve(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminApplication> {
    return this.svc.approve(id, req.user);
  }

  @Post(":id/reject")
  @HttpCode(200)
  reject(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RejectApplicationRequestSchema))
    body: RejectApplicationRequest,
  ): Promise<AdminApplication> {
    return this.svc.reject(id, req.user, body.reason);
  }

  @Post(":id/undo")
  @HttpCode(200)
  undo(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminApplication> {
    return this.svc.undo(id, req.user);
  }

  @Post(":id/ship")
  @HttpCode(200)
  ship(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ShipApplicationRequestSchema))
    body: ShipApplicationRequest,
  ): Promise<AdminApplication> {
    return this.svc.ship(
      id,
      req.user,
      body.trackingCarrier.trim(),
      body.trackingNumber.trim(),
    );
  }

  @Post(":id/deliver")
  @HttpCode(200)
  deliver(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminApplication> {
    return this.svc.deliver(id, req.user);
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
