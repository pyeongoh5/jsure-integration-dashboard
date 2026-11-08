import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { InfluencerMeController } from "./influencer-me.controller";
import { InfluencerMeService } from "./influencer-me.service";
import { InfluencerMeWithdrawalService } from "./influencer-me-withdrawal.service";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [PassportModule, InfluencerAuthModule, AuditModule],
  controllers: [InfluencerMeController],
  providers: [InfluencerMeService, InfluencerMeWithdrawalService],
})
export class InfluencerMeModule {}
