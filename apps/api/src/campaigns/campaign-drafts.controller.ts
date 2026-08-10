import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  CampaignDraftRequestSchema,
  CreateCampaignRequestSchema,
  type CampaignDraftRequest,
  type CampaignResponse,
  type CreateCampaignRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { CampaignsService } from "./campaigns.service";

/**
 * 캠페인 임시저장. 저장은 느슨한 스키마로 받고(제목만 필수), 발행 시점에
 * 캠페인 생성과 동일한 엄격 스키마로 검증한다.
 */
@UseGuards(JwtAuthGuard)
@Controller("campaign-drafts")
export class CampaignDraftsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  create(
    @Req() req: { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(CampaignDraftRequestSchema))
    body: CampaignDraftRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.createDraft(body, req.user);
  }

  @Patch(":id")
  update(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CampaignDraftRequestSchema))
    body: CampaignDraftRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.updateDraft(id, body, req.user);
  }

  @Post(":id/publish")
  publish(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CreateCampaignRequestSchema))
    body: CreateCampaignRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.publishDraft(id, body, req.user);
  }
}
