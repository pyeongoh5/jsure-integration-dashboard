# 파일 업로드 및 배치 인프라 설계

작성일: 2026-05-31
상태: 채택

## 배경

jsure는 기존에 파일 업로드와 사용자 트리거 배치 처리 요구가 없었다. 운영을 진행하면서 두 가지 요구가 추가됐다:

- **파일 업로드**: 인플루언서가 인사이트 결과(SNS 인사이트 화면 캡처)를 2~3장 업로드해서 admin이 검토. 향후 캠페인 썸네일 등 admin 측 공개 자산 업로드도 같은 인프라 위에 얹는다.
- **배치**: 데이터 조건에 따라 인플루언서/관리자에게 정기 알림을 발송한다 (마감일 임박, 정산 완료 통보 등).

현재 인프라:

| 영역 | 현황 |
|---|---|
| API | Railway + Dockerfile (NestJS 단일 인스턴스) |
| DB | Neon Postgres |
| 웹 | Vercel (admin-web, client-web) |
| 파일 업로드 | **없음** — `Campaign.thumbnailUrl`은 외부 URL을 문자열로 받는 필드 |
| 배치/스케줄 | **있음** — `@nestjs/schedule` 도입, `LineRemindersService`(매시간), `SessionsCleanupService`(매일 3AM) |
| LINE 메시징 | `LineMessagingService` 구현됨 |

## 결정 사항

### 1. 파일 업로드 — Cloudflare R2 추가

`@aws-sdk/client-s3` 호환 API. 브라우저가 NestJS API에서 발급한 presigned URL로 R2에 직접 업로드한다. API 서버는 업로드 트래픽을 거치지 않는다.

| 항목 | 결정 |
|---|---|
| 스토리지 제공자 | Cloudflare R2 |
| 업로드 흐름 | 브라우저 → presigned PUT URL → R2 |
| 다운로드 흐름 | API가 검토 시점에 presigned GET URL 발급 (단기 만료, 예: 5분) |
| 만료 정책 | **없음 — 영구 보관**. 운영 데이터 누적되면 정책 재정의 |
| 객체 키 구조 | `insights/{applicationId}/{snsType}/{uuid}.{ext}` (비공개)<br>`campaigns/{campaignId}/{uuid}.{ext}` (공개, 향후) |
| 버킷 정책 | 비공개. 직접 GET 차단. 공개 prefix는 향후 별도 정책으로 분리 |
| 파일 종류 제한 | 이미지 (`image/png`, `image/jpeg`, `image/webp`), 5MB 제한 |

### 2. 정기 알림 배치 — 기존 인프라 그대로

기존 `LineRemindersService` 패턴을 그대로 따른다.

- `@Cron(EVERY_HOUR)` 또는 적절 주기로 깨운다.
- DB 조건 스캔 → 매칭 row에 대해 `LineMessagingService`로 발송.
- 중복 발송 방지는 in-memory `Map` (날짜+엔티티 키로 dedup).
- 새 알림 종류가 늘면 같은 서비스 안에 `runXxxReminders()` 메서드를 추가하거나, 도메인별로 새 service 파일을 만들어 `ScheduleModule`에 붙인다.

추가 SaaS 불필요.

## 거절한 대안

### 파일 업로드 대안

| 대안 | 거절 사유 |
|---|---|
| **Supabase Storage** | Postgres RLS 통합은 강점이지만, jsure는 이미 Neon Postgres를 쓴다. Storage만 쓰면 Supabase의 핵심 장점을 활용하지 못하고, 단가도 R2보다 비싸다 ($0.021/GB vs $0.015/GB). |
| **Vercel Blob** | 설정은 가장 단순하지만 스토리지 단가가 R2의 10배($0.15/GB). 인사이트 스크린샷처럼 누적되는 데이터엔 장기 비용이 누적된다. |
| **AWS S3 + CloudFront** | egress 비용 발생 + 운영 부담. R2에 비해 비용/관리 이점 없음. |
| **Railway Volume** | 컨테이너 마운트 볼륨. API가 모든 파일 트래픽을 거치므로 CPU/메모리 부담. 백업·스케일 제약. |

### 배치 대안

| 대안 | 거절 사유 |
|---|---|
| **외부 스케줄러 (Cloudflare Workers Cron / Trigger.dev / GitHub Actions cron)** | 현재 단일 Railway 인스턴스 가정에선 `@nestjs/schedule`로 충분. 외부에 스케줄링을 두면 webhook/공유 시크릿 등 추가 표면이 늘어남. 다중 인스턴스 스케일 시점에 재검토. |
| **별도 워커 프로세스 + 큐 (BullMQ + Redis)** | 알림 발송은 가볍고 idempotent. 큐가 줄 정확도/재시도 이득 대비 Redis 도입 비용이 크다. 대량 처리(예: 일괄 정산 만 건)가 필요해지면 그때 도입. |

## 비용 추정 (R2)

스크린샷 평균 1MB 가정:

| 시나리오 | 누적 용량 | 월 비용 |
|---|---|---|
| 300장 | 0.3GB | $0 (무료 한도) |
| 1만 장 | 10GB | $0 (무료 한도 경계) |
| 5만 장 | 50GB | ≈ $0.6 |
| 50만 장 | 500GB | ≈ $7.4 |

egress는 무료라서 검토 화면에서 같은 이미지를 여러 번 열어봐도 트래픽 비용 0.

요청 비용(PUT/GET)은 일반 운영 규모에서 무시 가능 (100만 PUT/월 무료, 1000만 GET/월 무료).

## 향후 확장 트리거 (지금은 안 함)

| 트리거 | 대응 |
|---|---|
| 만료 정책이 필요해짐 | 단순 일괄 만료는 R2 lifecycle rule, 비즈니스 조건부 만료는 DB(`expiresAt` 컬럼) + cron으로 직접 삭제 |
| 컨테이너 재시작이 잦거나 같은 날 중복 발송이 보임 | 메모리 dedup → Postgres 테이블(`notification_log`)로 이전 |
| API를 다중 인스턴스로 horizontal scale | cron이 중복 트리거됨 → `pg_advisory_lock` 또는 외부 스케줄러로 이전. 그 시점에 BullMQ 등 큐 도입도 검토 |
| 영상 업로드 요구 | 파일 크기·전송 시간 늘어남 → 멀티파트 업로드, 트랜스코딩 파이프라인 (Cloudflare Stream 등 별도 검토) |
| 인사이트 자동 OCR 등 후처리 | R2 이벤트(또는 자체 webhook) 트리거 → 별도 워커. 큐 도입 신호. |

## 환경 변수 추가 사항

```
R2_ACCOUNT_ID=<cloudflare account id>
R2_ACCESS_KEY_ID=<r2 api token access key>
R2_SECRET_ACCESS_KEY=<r2 api token secret>
R2_BUCKET=jsure-uploads
R2_PUBLIC_BASE_URL=<퍼블릭 prefix 사용 시 — 향후>
```

`.env.example`에 키만 추가 (`.env`는 커밋 금지).

## 구현 진입 지점 (참고용 체크리스트)

이 문서는 설계 합의용. 구현 plan은 만들지 않는다. 작업 진입할 때 참고할 항목만 남긴다:

- Cloudflare 계정 생성, R2 버킷 1개(`jsure-uploads`), API 토큰 발급
- NestJS에 `R2Service` (presigned URL 발급, S3 client 래퍼)
- `POST /uploads/insight/presign` 같은 발급 엔드포인트 (소유자 검증 포함)
- `SubmittedPost` 또는 별도 `SubmittedPostAttachment` 테이블에 객체 키 저장 (스키마 결정은 구현 시점에)
- admin 검토 화면에서 GET presigned URL 발급해서 `<img>` src로 표시
- 알림 배치는 `LineRemindersService` 패턴을 따라 새 cron handler 추가
