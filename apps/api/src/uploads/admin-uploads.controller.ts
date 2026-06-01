import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  CampaignThumbnailUploadPresignRequestSchema,
  type CampaignThumbnailUploadPresignRequest,
  type CampaignThumbnailUploadPresignResponse,
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
}
