import { Module } from "@nestjs/common";
import { CampaignDraftsController } from "./campaign-drafts.controller";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";
import { CampaignAudienceService } from "./campaign-audience.service";
import { UploadsModule } from "../uploads/uploads.module";

@Module({
  imports: [UploadsModule],
  controllers: [CampaignsController, CampaignDraftsController],
  providers: [CampaignsService, CampaignAudienceService],
})
export class CampaignsModule {}
