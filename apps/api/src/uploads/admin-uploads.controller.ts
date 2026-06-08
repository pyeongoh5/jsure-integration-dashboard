import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  CampaignImageUploadPresignRequestSchema,
  CampaignThumbnailUploadPresignRequestSchema,
  NoticeImageUploadPresignRequestSchema,
  type CampaignImageUploadPresignRequest,
  type CampaignImageUploadPresignResponse,
  type CampaignThumbnailUploadPresignRequest,
  type CampaignThumbnailUploadPresignResponse,
  type NoticeImageUploadPresignRequest,
  type NoticeImageUploadPresignResponse,
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

  @Post("campaign-image/presign")
  presignCampaignImage(
    @Body(new ZodValidationPipe(CampaignImageUploadPresignRequestSchema))
    body: CampaignImageUploadPresignRequest,
  ): Promise<CampaignImageUploadPresignResponse> {
    return this.svc.presignCampaignImageUpload(body);
  }
}
