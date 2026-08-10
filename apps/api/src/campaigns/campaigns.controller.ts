import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
  type CampaignListResponse,
  type CampaignResponse,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { CampaignsService } from "./campaigns.service";

@UseGuards(JwtAuthGuard)
@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  create(
    @Req() req: { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(CreateCampaignRequestSchema))
    body: CreateCampaignRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.create(body, req.user);
  }

  /** includeDrafts=1 은 어드민 캠페인 관리 화면 전용 — 임시저장을 함께 반환한다. */
  @Get()
  async list(
    @Query("includeDrafts") includeDrafts?: string,
  ): Promise<CampaignListResponse> {
    const campaigns = await this.campaigns.findAll(includeDrafts === "1");
    return { campaigns };
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<CampaignResponse> {
    return this.campaigns.findById(id);
  }

  @Patch(":id")
  update(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateCampaignRequestSchema))
    body: UpdateCampaignRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.update(id, body, req.user);
  }

  @Post(":id/close")
  close(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<CampaignResponse> {
    return this.campaigns.close(id, req.user);
  }

  /** 비공개 전환 — 모집이 종결된 캠페인만 가능하다. */
  @Post(":id/hide")
  hide(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<CampaignResponse> {
    return this.campaigns.hide(id, req.user);
  }

  @Post(":id/unhide")
  unhide(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<CampaignResponse> {
    return this.campaigns.unhide(id, req.user);
  }

  /** 임시저장은 물리 삭제, 발행된 캠페인은 종료와 함께 논리 삭제. */
  @Delete(":id")
  remove(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<void> {
    return this.campaigns.remove(id, req.user);
  }
}
