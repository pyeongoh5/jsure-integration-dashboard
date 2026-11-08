import { Global, Module } from "@nestjs/common";
import { LineMessagingService } from "./line-messaging.service";

/**
 * LINE push 클라이언트. 인증과는 무관한데도 InfluencerAuthModule 안에 묶여
 * 있던 탓에, LINE 을 쓰려는 모듈이 인증 모듈 전체를 끌어와야 했다. 그 때문에
 * InfluencersModule → LineTemplatesModule → InfluencerAuthModule →
 * InfluencersModule 순환이 생겨 부팅이 깨졌다.
 *
 * 채널 토큰을 캐시하므로 인스턴스는 하나여야 한다. 소비자가 6곳에 흩어져
 * 있어 AuditModule·PrismaModule 과 같은 @Global 로 둔다.
 *
 * ponytail: 서비스 파일은 influencer-auth/ 에 그대로 뒀다 — 옮기면 import 경로가
 * 8곳 바뀐다. 이 폴더에서 인증 외 코드를 더 덜어낼 때 함께 line-templates/ 로 옮길 것.
 */
@Global()
@Module({
  providers: [LineMessagingService],
  exports: [LineMessagingService],
})
export class LineMessagingModule {}
