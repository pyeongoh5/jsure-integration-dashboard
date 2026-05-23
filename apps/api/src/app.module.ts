import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { AdminUsersModule } from "./admin-users/admin-users.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { HealthModule } from "@/health/health.module";
import { InfluencersModule } from "./influencers/influencers.module";
import { InfluencerAuthModule } from "./influencer-auth/influencer-auth.module";
import { InfluencerCampaignsModule } from "./influencer-campaigns/influencer-campaigns.module";
import { InfluencerApplicationsModule } from "./influencer-applications/influencer-applications.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AdminUsersModule,
    CampaignsModule,
    HealthModule,
    InfluencersModule,
    InfluencerAuthModule,
    InfluencerCampaignsModule,
    InfluencerApplicationsModule,
  ],
})
export class AppModule {}
