import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { InfluencerApplicationsController } from "./influencer-applications.controller";
import { InfluencerApplicationsService } from "./influencer-applications.service";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";
import { UploadsModule } from "../uploads/uploads.module";

@Module({
  imports: [PassportModule, InfluencerAuthModule, UploadsModule],
  controllers: [InfluencerApplicationsController],
  providers: [InfluencerApplicationsService],
})
export class InfluencerApplicationsModule {}
