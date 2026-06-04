import { Module } from "@nestjs/common";
import { UploadsModule } from "../uploads/uploads.module";
import { AdminNoticesController } from "./admin-notices.controller";
import { AdminNoticesService } from "./admin-notices.service";

@Module({
  imports: [UploadsModule],
  controllers: [AdminNoticesController],
  providers: [AdminNoticesService],
})
export class AdminNoticesModule {}
