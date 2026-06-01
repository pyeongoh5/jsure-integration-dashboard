import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import {
  InsightUploadPresignRequestSchema,
  type InsightUploadPresignRequest,
  type InsightUploadPresignResponse,
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
}
