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
import { InfluencerMeModule } from "./influencer-me/influencer-me.module";
import { AdminApplicationsModule } from "./admin-applications/admin-applications.module";
import { AdminOverviewModule } from "./admin-overview/admin-overview.module";
import { AdminReportsModule } from "./admin-reports/admin-reports.module";
import { AdminBroadcastsModule } from "./admin-broadcasts/admin-broadcasts.module";
import { AdminNoticesModule } from "./admin-notices/admin-notices.module";
import { InfluencerNoticesModule } from "./influencer-notices/influencer-notices.module";
import { R2Module } from "./r2/r2.module";
import { UploadsModule } from "./uploads/uploads.module";
import { LineTemplatesModule } from "./line-templates/line-templates.module";
import { AdminMeModule } from "./admin-me/admin-me.module";

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
    InfluencerMeModule,
    AdminApplicationsModule,
    AdminOverviewModule,
    AdminReportsModule,
    AdminBroadcastsModule,
    AdminNoticesModule,
    InfluencerNoticesModule,
    R2Module,
    UploadsModule,
    LineTemplatesModule,
    AdminMeModule,
  ],
})
export class AppModule {}
