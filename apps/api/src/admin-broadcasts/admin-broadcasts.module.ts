import { Module } from "@nestjs/common";
import { AdminBroadcastsController } from "./admin-broadcasts.controller";
import { AdminBroadcastsService } from "./admin-broadcasts.service";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";
import { UploadsModule } from "../uploads/uploads.module";

@Module({
  imports: [InfluencerAuthModule, UploadsModule],
  controllers: [AdminBroadcastsController],
  providers: [AdminBroadcastsService],
})
export class AdminBroadcastsModule {}
