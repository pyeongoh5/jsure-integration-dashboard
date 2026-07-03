import {
  BadRequestException,
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
  RejectSubmittedPostRequestSchema,
  ShipApplicationRequestSchema,
  type AdminApplication,
  type AdminApplicationCountsResponse,
  type AdminApplicationListResponse,
  type AdminSubmittedPost,
  type AdminSettlementListResponse,
  type AdminSubmittedPostListResponse,
  type ApprovedApplicantExportResponse,
  type AttachmentListResponse,
  type ApplicationStatus,
  type RejectApplicationRequest,
  type RejectSubmittedPostRequest,
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

  @Get("submitted-posts")
  async submittedPosts(): Promise<AdminSubmittedPostListResponse> {
    const posts = await this.svc.listSubmittedPosts();
    return { posts };
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

  @Post("submitted-posts/:postId/approve")
  @HttpCode(200)
  approveSubmittedPost(
    @Req() req: { user: AuthenticatedUser },
    @Param("postId") postId: string,
  ): Promise<AdminSubmittedPost> {
    return this.svc.approveSubmittedPost(postId, req.user.id);
  }

  @Post("submitted-posts/:postId/reject")
  @HttpCode(200)
  rejectSubmittedPost(
    @Req() req: { user: AuthenticatedUser },
    @Param("postId") postId: string,
    @Body(new ZodValidationPipe(RejectSubmittedPostRequestSchema))
    body: RejectSubmittedPostRequest,
  ): Promise<AdminSubmittedPost> {
    return this.svc.rejectSubmittedPost(
      postId,
      req.user.id,
      body.comment.trim(),
    );
  }

  @Post("submitted-posts/:postId/undo")
  @HttpCode(200)
  undoSubmittedPostReview(
    @Param("postId") postId: string,
  ): Promise<AdminSubmittedPost> {
    return this.svc.undoSubmittedPostReview(postId);
  }

  @Post("submitted-posts/:postId/settle")
  @HttpCode(200)
  settleSubmittedPost(
    @Req() req: { user: AuthenticatedUser },
    @Param("postId") postId: string,
  ): Promise<AdminSubmittedPost> {
    return this.svc.settleSubmittedPost(postId, req.user.id);
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

  @Get("submitted-posts/pending-count")
  pendingReviewCount(): Promise<{ count: number }> {
    return this.svc.pendingReviewCount();
  }

  @Post("settlements/complete")
  @HttpCode(200)
  completeSettlements(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: { ids?: string[] },
  ): Promise<{ completedCount: number }> {
    return this.svc.completeSettlements(req.user.id, body.ids);
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

  @Post(":id/ship")
  @HttpCode(200)
  ship(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ShipApplicationRequestSchema))
    body: ShipApplicationRequest,
  ): Promise<AdminApplication> {
    return this.svc.ship(
      id,
      body.trackingCarrier.trim(),
      body.trackingNumber.trim(),
    );
  }

  @Post(":id/deliver")
  @HttpCode(200)
  deliver(@Param("id") id: string): Promise<AdminApplication> {
    return this.svc.deliver(id);
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
