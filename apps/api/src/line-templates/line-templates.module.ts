import { Module } from "@nestjs/common";
import { LineDispatcherService } from "./line-dispatcher.service";
import { LineRemindersService } from "./line-reminders.service";
import { AdminLineTemplatesService } from "./admin-line-templates.service";
import { AdminLineTemplatesController } from "./admin-line-templates.controller";

@Module({
  controllers: [AdminLineTemplatesController],
  providers: [LineDispatcherService, LineRemindersService, AdminLineTemplatesService],
  exports: [LineDispatcherService],
})
export class LineTemplatesModule {}
