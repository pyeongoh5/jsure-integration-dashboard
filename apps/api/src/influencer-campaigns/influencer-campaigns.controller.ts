import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { SnsTypeSchema, type SnsType } from "@jsure/shared";
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
    @Query("sns") sns?: string,
  ) {
    let parsed: SnsType | undefined = undefined;
    if (sns) {
      const result = SnsTypeSchema.safeParse(sns);
      parsed = result.success ? result.data : undefined;
    }
    const campaigns = await this.svc.list({
      influencerId: req.user.id,
      sns: parsed,
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
