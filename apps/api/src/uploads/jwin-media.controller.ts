import { Controller, Get, NotFoundException, Param, Redirect } from "@nestjs/common";
import { R2Service } from "../r2/r2.service";

// J-WIN 스케줄러가 매일 게시 시각마다 이 URL로 fetch 하므로, presigned GET을 직접 저장하지 않고
// 이 컨트롤러를 거쳐 그때그때 새로 발급한다. 리다이렉트 직후 클라이언트가 바로 따라가므로 수 분이면 충분하다.
const REDIRECT_PRESIGN_EXPIRES_SEC = 300;

// jwin/media/${randomUUID()}.${ext} 형태로만 발급되므로, 그 형태와 정확히 일치하는 이름만 허용한다.
// UUID + 허용 확장자 외에는 전부 거부해 경로 순회나 버킷 내 임의 키 접근을 차단한다.
const OBJECT_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|mp4)$/i;

// 인증 가드를 의도적으로 붙이지 않는다 — R2 버킷을 공개로 두는 대신 이 엔드포인트가
// 공개 버킷 객체처럼 동작해야 하므로, 누구나 objectName만 알면 접근 가능해야 한다.
@Controller("uploads/jwin-media")
export class JwinMediaController {
  constructor(private readonly r2: R2Service) {}

  @Get(":objectName")
  @Redirect()
  async getMedia(
    @Param("objectName") objectName: string,
  ): Promise<{ url: string; statusCode: number }> {
    if (!OBJECT_NAME_PATTERN.test(objectName)) {
      throw new NotFoundException("존재하지 않는 미디어입니다");
    }
    const objectKey = `jwin/media/${objectName}`;
    const url = await this.r2.presignGet(objectKey, REDIRECT_PRESIGN_EXPIRES_SEC);
    return { url, statusCode: 302 };
  }
}
