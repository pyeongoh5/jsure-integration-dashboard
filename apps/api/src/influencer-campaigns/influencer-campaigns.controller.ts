import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { CampaignCategorySchema, type CampaignCategory } from "@jsure/shared";
import { InfluencerJwtAuthGuard } from "../influencer-auth/guards/influencer-jwt-auth.guard";
import type { AuthenticatedInfluencer } from "../influencer-auth/strategies/influencer-jwt.strategy";
import { InfluencerCampaignsService } from "./influencer-campaigns.service";

@UseGuards(InfluencerJwtAuthGuard)
@Controller("influencer/campaigns")
export class InfluencerCampaignsController {
  constructor(private readonly svc: InfluencerCampaignsService) {}

  @Get()
  async list(
    @Request() req: { user: AuthenticatedInfluencer },
    @Query("category") category?: string,
  ) {
    let parsed: CampaignCategory | undefined = undefined;
    if (category) {
      const result = CampaignCategorySchema.safeParse(category);
      parsed = result.success ? result.data : undefined;
    }
    const campaigns = await this.svc.list({
      influencerId: req.user.id,
      category: parsed,
    });
    return { campaigns };
  }

  @Get(":id")
  detail(
    @Request() req: { user: AuthenticatedInfluencer },
    @Param("id") id: string,
  ) {
    return this.svc.detail({ influencerId: req.user.id, campaignId: id });
  }
}
