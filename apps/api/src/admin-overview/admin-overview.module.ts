import { Module } from "@nestjs/common";
import { LineTemplatesModule } from "../line-templates/line-templates.module";
import { AdminOverviewController } from "./admin-overview.controller";
import { AdminOverviewService } from "./admin-overview.service";
import { AdminCampaignBoardService } from "./admin-campaign-board.service";
import { AdminDailyAlertsService } from "./admin-daily-alerts.service";

@Module({
  imports: [LineTemplatesModule],
  controllers: [AdminOverviewController],
  providers: [
    AdminOverviewService,
    AdminCampaignBoardService,
    AdminDailyAlertsService,
  ],
})
export class AdminOverviewModule {}
