import { Module } from "@nestjs/common";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";
import { UploadsModule } from "../uploads/uploads.module";
import { InfluencerNoticesController } from "./influencer-notices.controller";
import { InfluencerNoticesService } from "./influencer-notices.service";

@Module({
  imports: [InfluencerAuthModule, UploadsModule],
  controllers: [InfluencerNoticesController],
  providers: [InfluencerNoticesService],
})
export class InfluencerNoticesModule {}
