import { Module } from "@nestjs/common";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";
import { LineDispatcherService } from "./line-dispatcher.service";
import { LineRemindersService } from "./line-reminders.service";

@Module({
  imports: [InfluencerAuthModule],
  providers: [LineDispatcherService, LineRemindersService],
  exports: [LineDispatcherService],
})
export class LineTemplatesModule {}
