import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import {
  InsightUploadPresignRequestSchema,
  InfluencerAttachmentPresignRequestSchema,
  type InsightUploadPresignRequest,
  type InsightUploadPresignResponse,
  type InfluencerAttachmentPresignRequest,
  type InfluencerAttachmentPresignResponse,
} from "@jsure/shared";
import { InfluencerJwtAuthGuard } from "../influencer-auth/guards/influencer-jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { UploadsService } from "./uploads.service";

@UseGuards(InfluencerJwtAuthGuard)
@Controller("uploads")
export class UploadsController {
  constructor(private readonly svc: UploadsService) {}

  @Post("insight/presign")
  presignInsight(
    @Req() req: { user: { id: string } },
    @Body(new ZodValidationPipe(InsightUploadPresignRequestSchema))
    body: InsightUploadPresignRequest,
  ): Promise<InsightUploadPresignResponse> {
    return this.svc.presignInsightUpload(req.user.id, body);
  }

  @Post("influencer/attachment/presign")
  presignInfluencerAttachment(
    @Req() req: { user: { id: string } },
    @Body(new ZodValidationPipe(InfluencerAttachmentPresignRequestSchema))
    body: InfluencerAttachmentPresignRequest,
  ): Promise<InfluencerAttachmentPresignResponse> {
    return this.svc.presignInfluencerAttachment(req.user.id, body);
  }
}
