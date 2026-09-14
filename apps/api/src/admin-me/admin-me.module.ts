import { Module } from "@nestjs/common";
import { AdminUsersModule } from "../admin-users/admin-users.module";
import { AdminMeController } from "./admin-me.controller";

@Module({
  imports: [AdminUsersModule],
  controllers: [AdminMeController],
})
export class AdminMeModule {}
