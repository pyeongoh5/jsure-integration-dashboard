import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import {
  CreateApplicationRequestSchema,
  SubmitInsightsRequestSchema,
  SubmitOrderRequestSchema,
  SubmitSubmissionRequestSchema,
  SubmitReviewRequestSchema,
  SubmitSimpleReviewRequestSchema,
  type CreateApplicationRequest,
  type SubmitInsightsRequest,
  type SubmitOrderRequest,
  type SubmitSubmissionRequest,
  type SubmitReviewRequest,
  type SubmitSimpleReviewRequest,
} from "@jsure/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { InfluencerJwtAuthGuard } from "../influencer-auth/guards/influencer-jwt-auth.guard";
import type { AuthenticatedInfluencer } from "../influencer-auth/strategies/influencer-jwt.strategy";
import { InfluencerApplicationsService } from "./influencer-applications.service";

@UseGuards(InfluencerJwtAuthGuard)
@Controller("influencer/applications")
export class InfluencerApplicationsController {
  constructor(private readonly svc: InfluencerApplicationsService) {}

  @Get()
  async list(@Request() req: { user: AuthenticatedInfluencer }) {
    const applications = await this.svc.listForInfluencer(req.user.id);
    return { applications };
  }

  @Get(":id")
  getOne(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("id") id: string,
  ) {
    return this.svc.getForInfluencer(req.user.id, id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateApplicationRequestSchema))
  create(
    @Request() req: { user: AuthenticatedInfluencer },
    @Body() dto: CreateApplicationRequest,
  ) {
    return this.svc.create(
      req.user.id,
      dto.campaignId,
      dto.subTypes,
      dto.instagramPostType ?? null,
    );
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("id") id: string,
  ) {
    return this.svc.cancel(req.user.id, id);
  }

  @Post(":id/order")
  @HttpCode(200)
  submitOrder(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(SubmitOrderRequestSchema))
    dto: SubmitOrderRequest,
  ) {
    return this.svc.submitOrder(req.user.id, id, dto.orderNumber, dto.receipts);
  }

  @Post(":id/review")
  @HttpCode(200)
  submitReview(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(SubmitReviewRequestSchema))
    dto: SubmitReviewRequest,
  ) {
    return this.svc.submitReview(req.user.id, id, dto.screenshots, dto.reviewUrls);
  }

  @Post(":id/simple-review")
  @HttpCode(200)
  submitSimpleReview(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(SubmitSimpleReviewRequestSchema))
    dto: SubmitSimpleReviewRequest,
  ) {
    return this.svc.submitSimpleReview(
      req.user.id,
      id,
      dto.reviews,
      dto.screenshots,
    );
  }

  @Post(":id/confirm-receipt")
  @HttpCode(200)
  confirmReceipt(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("id") id: string,
  ) {
    return this.svc.confirmReceipt(req.user.id, id);
  }

  /** SNS 게시물 URL 일괄 제출 — 참여한 모든 서브타입을 한 번에. */
  @Put(":id/submission")
  submitSubmission(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(SubmitSubmissionRequestSchema))
    dto: SubmitSubmissionRequest,
  ) {
    return this.svc.submitSubmission(req.user.id, id, dto.posts);
  }

  /** SNS 인사이트 일괄 제출 — 참여한 모든 서브타입을 한 번에. */
  @Put(":id/insights")
  submitInsights(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(SubmitInsightsRequestSchema))
    dto: SubmitInsightsRequest,
  ) {
    return this.svc.submitInsights(req.user.id, id, dto.insights);
  }
}
