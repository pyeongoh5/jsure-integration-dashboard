import { Module } from "@nestjs/common";
import { InfluencersService } from "./influencers.service";

@Module({
  providers: [InfluencersService],
  exports: [InfluencersService],
})
export class InfluencersModule {}
