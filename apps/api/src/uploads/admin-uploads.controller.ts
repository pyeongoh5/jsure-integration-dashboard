import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  AdminInsightScreenshotPresignRequestSchema,
  CampaignImageUploadPresignRequestSchema,
  CampaignThumbnailUploadPresignRequestSchema,
  NoticeImageUploadPresignRequestSchema,
  JwinMediaUploadPresignRequestSchema,
  type AdminInsightScreenshotPresignRequest,
  type CampaignImageUploadPresignRequest,
  type CampaignImageUploadPresignResponse,
  type CampaignThumbnailUploadPresignRequest,
  type CampaignThumbnailUploadPresignResponse,
  type InsightUploadPresignResponse,
  type NoticeImageUploadPresignRequest,
  type NoticeImageUploadPresignResponse,
  type JwinMediaUploadPresignRequest,
  type JwinMediaUploadPresignResponse,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { UploadsService } from "./uploads.service";

@UseGuards(JwtAuthGuard)
@Controller("uploads/admin")
export class AdminUploadsController {
  constructor(private readonly svc: UploadsService) {}

  @Post("campaign-thumbnail/presign")
  presignCampaignThumbnail(
    @Body(new ZodValidationPipe(CampaignThumbnailUploadPresignRequestSchema))
    body: CampaignThumbnailUploadPresignRequest,
  ): Promise<CampaignThumbnailUploadPresignResponse> {
    return this.svc.presignCampaignThumbnailUpload(body);
  }

  @Post("notice-image/presign")
  presignNoticeImage(
    @Body(new ZodValidationPipe(NoticeImageUploadPresignRequestSchema))
    body: NoticeImageUploadPresignRequest,
  ): Promise<NoticeImageUploadPresignResponse> {
    return this.svc.presignNoticeImageUpload(body);
  }

  /** 인사이트 스크린샷 교체·추가 — 인플루언서 업로드와 동일한 objectKey 규칙. */
  @Post("insight-screenshot/presign")
  presignInsightScreenshot(
    @Body(new ZodValidationPipe(AdminInsightScreenshotPresignRequestSchema))
    body: AdminInsightScreenshotPresignRequest,
  ): Promise<InsightUploadPresignResponse> {
    return this.svc.presignAdminInsightUpload(body);
  }

  @Post("campaign-image/presign")
  presignCampaignImage(
    @Body(new ZodValidationPipe(CampaignImageUploadPresignRequestSchema))
    body: CampaignImageUploadPresignRequest,
  ): Promise<CampaignImageUploadPresignResponse> {
    return this.svc.presignCampaignImageUpload(body);
  }

  @Post("jwin-media/presign")
  presignJwinMedia(
    @Body(new ZodValidationPipe(JwinMediaUploadPresignRequestSchema))
    body: JwinMediaUploadPresignRequest,
  ): Promise<JwinMediaUploadPresignResponse> {
    return this.svc.presignJwinMediaUpload(body);
  }
}
