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
  CampaignSubTypeSchema,
  CreateApplicationRequestSchema,
  SubmitInsightRequestSchema,
  SubmitOrderRequestSchema,
  SubmitPostRequestSchema,
  SubmitReviewRequestSchema,
  SubmitSimpleReviewRequestSchema,
  type CreateApplicationRequest,
  type SubmitInsightRequest,
  type SubmitOrderRequest,
  type SubmitPostRequest,
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
    return this.svc.submitSimpleReview(req.user.id, id, dto.url, dto.screenshots);
  }

  @Post(":id/confirm-receipt")
  @HttpCode(200)
  confirmReceipt(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("id") id: string,
  ) {
    return this.svc.confirmReceipt(req.user.id, id);
  }

  @Put(":id/posts/:snsType")
  upsertPost(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("id") id: string,
    @Param("snsType") snsTypeRaw: string,
    @Body(new ZodValidationPipe(SubmitPostRequestSchema)) dto: SubmitPostRequest,
  ) {
    const snsType = CampaignSubTypeSchema.parse(snsTypeRaw);
    return this.svc.upsertPost(req.user.id, id, snsType, dto.url);
  }

  @Put(":id/posts/:snsType/insight")
  upsertInsight(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("id") id: string,
    @Param("snsType") snsTypeRaw: string,
    @Body(new ZodValidationPipe(SubmitInsightRequestSchema))
    dto: SubmitInsightRequest,
  ) {
    const snsType = CampaignSubTypeSchema.parse(snsTypeRaw);
    return this.svc.upsertInsight(req.user.id, id, snsType, dto);
  }
}
