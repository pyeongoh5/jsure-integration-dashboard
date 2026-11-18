import { Module } from "@nestjs/common";
import { BuilderSurveysController } from "./builder-surveys.controller";
import { BuilderSurveysService } from "./builder-surveys.service";

@Module({
  controllers: [BuilderSurveysController],
  providers: [BuilderSurveysService],
})
export class BuilderSurveysModule {}
