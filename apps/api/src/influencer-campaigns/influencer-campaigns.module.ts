import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { InfluencerCampaignsController } from "./influencer-campaigns.controller";
import { InfluencerCampaignsService } from "./influencer-campaigns.service";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";

@Module({
  imports: [PassportModule, InfluencerAuthModule],
  controllers: [InfluencerCampaignsController],
  providers: [InfluencerCampaignsService],
  exports: [InfluencerCampaignsService],
})
export class InfluencerCampaignsModule {}
