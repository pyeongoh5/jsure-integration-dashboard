import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
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
  @UsePipes(new ZodValidationPipe(CreateCampaignRequestSchema))
  create(@Body() body: CreateCampaignRequest): Promise<CampaignResponse> {
    return this.campaigns.create(body);
  }

  @Get()
  async list(): Promise<CampaignListResponse> {
    const campaigns = await this.campaigns.findAll();
    return { campaigns };
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<CampaignResponse> {
    return this.campaigns.findById(id);
  }

  @Patch(":id")
  @UsePipes(new ZodValidationPipe(UpdateCampaignRequestSchema))
  update(
    @Param("id") id: string,
    @Body() body: UpdateCampaignRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.update(id, body);
  }

  @Post(":id/close")
  close(@Param("id") id: string): Promise<CampaignResponse> {
    return this.campaigns.close(id);
  }
}
