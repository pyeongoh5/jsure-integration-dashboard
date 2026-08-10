import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";

/**
 * 감사 로그는 거의 모든 어드민 도메인이 쓰므로 모듈마다 import 하지 않도록
 * PrismaModule 과 같은 @Global() 로 둔다.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
