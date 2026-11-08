import { Module } from "@nestjs/common";
import { InfluencersController } from "./influencers.controller";
import { InfluencersService } from "./influencers.service";
import { LineTemplatesModule } from "../line-templates/line-templates.module";

@Module({
  imports: [LineTemplatesModule],
  controllers: [InfluencersController],
  providers: [InfluencersService],
  exports: [InfluencersService],
})
export class InfluencersModule {}
