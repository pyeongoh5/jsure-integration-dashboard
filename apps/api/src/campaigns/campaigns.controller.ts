import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { CampaignsService } from "./campaigns.service";

@UseGuards(JwtAuthGuard)
@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateCampaignRequestSchema))
    body: CreateCampaignRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.create(body);
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
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateCampaignRequestSchema))
    body: UpdateCampaignRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.update(id, body);
  }

  @Post(":id/close")
  close(@Param("id") id: string): Promise<CampaignResponse> {
    return this.campaigns.close(id);
  }

  /** 비공개 전환 — 모집이 종결된 캠페인만 가능하다. */
  @Post(":id/hide")
  hide(@Param("id") id: string): Promise<CampaignResponse> {
    return this.campaigns.hide(id);
  }

  @Post(":id/unhide")
  unhide(@Param("id") id: string): Promise<CampaignResponse> {
    return this.campaigns.unhide(id);
  }

  /** 임시저장은 물리 삭제, 발행된 캠페인은 종료와 함께 논리 삭제. */
  @Delete(":id")
  remove(@Param("id") id: string): Promise<void> {
    return this.campaigns.remove(id);
  }
}
