import { Module } from "@nestjs/common";
import { AdminApplicationsController } from "./admin-applications.controller";
import { AdminApplicationsService } from "./admin-applications.service";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";
import { LineTemplatesModule } from "../line-templates/line-templates.module";

@Module({
  imports: [InfluencerAuthModule, LineTemplatesModule],
  controllers: [AdminApplicationsController],
  providers: [AdminApplicationsService],
})
export class AdminApplicationsModule {}
