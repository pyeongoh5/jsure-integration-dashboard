import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { InfluencerAuthController } from "./influencer-auth.controller";
import { InfluencerAuthService } from "./influencer-auth.service";
import { InfluencerLineAuthService } from "./influencer-line-auth.service";
import { LineMessagingService } from "./line-messaging.service";
import { InfluencerSessionsService } from "./influencer-sessions.service";
import { InfluencerJwtStrategy } from "./strategies/influencer-jwt.strategy";
import { InfluencersModule } from "../influencers/influencers.module";

@Module({
  imports: [
    InfluencersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: config.get<string>("JWT_EXPIRES_IN") ?? "1d",
        },
      }),
    }),
  ],
  providers: [
    InfluencerAuthService,
    InfluencerLineAuthService,
    LineMessagingService,
    InfluencerSessionsService,
    InfluencerJwtStrategy,
  ],
  controllers: [InfluencerAuthController],
  exports: [
    InfluencerAuthService,
    InfluencerJwtStrategy,
    LineMessagingService,
  ],
})
export class InfluencerAuthModule {}
