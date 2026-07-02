import { Module } from "@nestjs/common";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";
import { LineDispatcherService } from "./line-dispatcher.service";

@Module({
  imports: [InfluencerAuthModule],
  providers: [LineDispatcherService],
  exports: [LineDispatcherService],
})
export class LineTemplatesModule {}
