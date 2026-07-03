import { Module } from "@nestjs/common";
import { AdminMeController } from "./admin-me.controller";

@Module({
  controllers: [AdminMeController],
})
export class AdminMeModule {}
