import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { InfluencerMeController } from "./influencer-me.controller";
import { InfluencerMeService } from "./influencer-me.service";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";

@Module({
  imports: [PassportModule, InfluencerAuthModule],
  controllers: [InfluencerMeController],
  providers: [InfluencerMeService],
})
export class InfluencerMeModule {}
