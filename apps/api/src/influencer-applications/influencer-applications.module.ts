import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { InfluencerApplicationsController } from "./influencer-applications.controller";
import { InfluencerApplicationsService } from "./influencer-applications.service";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";

@Module({
  imports: [PassportModule, InfluencerAuthModule],
  controllers: [InfluencerApplicationsController],
  providers: [InfluencerApplicationsService],
})
export class InfluencerApplicationsModule {}
