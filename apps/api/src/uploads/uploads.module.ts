import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";
import { AuthModule } from "../auth/auth.module";
import { AdminUploadsController } from "./admin-uploads.controller";
import { JwinMediaController } from "./jwin-media.controller";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";

@Module({
  imports: [PrismaModule, InfluencerAuthModule, AuthModule],
  controllers: [UploadsController, AdminUploadsController, JwinMediaController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
