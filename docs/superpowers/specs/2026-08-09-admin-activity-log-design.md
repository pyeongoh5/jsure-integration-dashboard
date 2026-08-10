# 어드민 액션 감사 로그(AdminActivityLog) 설계

## 배경 / 문제

어드민이 여러 명(`AdminUser` 다계정, JWT `req.user.id`로 항상 식별 가능)인데, "어떤 어드민이 무엇을 했는지"의 기록이 액션마다 제각각이다.

현재 상태 (2026-08-09 main 기준):

| 도메인 | 액션 | 수행자 기록 |
|---|---|---|
| 응모 | 승인/거절 | ✅ `CampaignApplication.reviewedById` |
| 응모 | 제출물 승인/거절 | ✅ `submissionReviewedById`, `SubmissionRejection.rejectedById` |
| 응모 | undo(승인·검토 취소) | ❌ 기존 검토자 값까지 `null`로 소거 |
| 응모 | 발송(ship)/배송완료(deliver) | ❌ 컬럼 없음 |
| 정산 | 일괄 완료 | ✅ `Settlement.completedById` |
| 정산 | 자동완료(0엔)·수동 등록(`settleSubmission`) | ❌ 미기록 (`settleSubmission`은 `req.user`도 안 받음) |
| 인플루언서 | 메모 작성 / 플래그 설정 | ✅ `InfluencerMemo.createdById` / `Influencer.flaggedById` |
| 인플루언서 | 플래그 해제 | ❌ 미기록 |
| 캠페인 | 생성/수정/종료/숨김/삭제, 드래프트 발행 | ❌ **전면 미기록** — actor 컬럼도, 컨트롤러 `@Req()` 전달도 없음 |

구조적 한계 2가지:

- 상태 컬럼(`reviewedById` 등)은 **현재 값**만 남는다. 승인→취소→재승인 같은 **변경 이력**이 없다.
- actor 컬럼이 FK 없는 `String?`이라 어드민 계정 삭제 시 추적이 끊긴다.

## 목표

- append-only **범용 감사 로그 테이블 1개**로 어드민 변경 액션 전체를 시계열 기록한다.
- **응모건(`CampaignApplication`) 단위 타임라인 UI**를 지원한다 — 단일 인덱스 쿼리로 조회, 데이터가 쌓여도 성능 무관.
- 액터 귀속 규칙을 명문화한다 (아래 "액터 귀속 규칙").

## 비목표

- 기존 상태 컬럼(`reviewedById`, `completedById`, `createdById`, `flaggedById`)의 제거/대체는 하지 않는다. 목록·상세 화면의 "현재 상태" 조회는 그대로 상태 컬럼을 쓴다. 로그는 이력용 **추가**다(하이브리드).
- 도입 이전 데이터의 백필은 하지 않는다. 타임라인은 도입 시점부터 시작한다(UI는 "이전 이력 없음"을 자연스럽게 처리).
- 1차에서 로그 기록을 트랜잭션 필수(mandatory)로 만들지 않는다 — **best-effort**로 시작한다(아래 "정책 결정"). 현재 서비스 대부분이 `$transaction`을 쓰지 않아 mandatory로 가려면 대규모 트랜잭션 리팩토링이 동반되고 회귀 위험이 크다. 정산 등 금전 액션의 in-transaction 승격은 후속 작업.
- 공지/브로드캐스트/LINE 템플릿/어드민 계정 관리 액션의 계측은 후속 확장. 각자 `authorId`/`createdById`/`updatedById`를 이미 보유하고 있고 응모 타임라인과 무관하다.
- 보존 정책(아카이빙·파티셔닝)은 볼륨이 실제로 커진 뒤 도입.

## 정책 결정 (사전 논의에서 확정)

1. **기록 실패는 액션을 막지 않는다(best-effort).** `AuditService.record()`는 내부에서 예외를 삼키고 `Logger.error`로만 남긴다.
2. **연쇄(cascade) 액션은 유발한 어드민에게 귀속하되 `origin: CASCADE`로 구분한다.** 예: 제출물 승인의 부수효과로 0엔 정산이 자동완료되면 액터는 승인한 어드민, origin은 CASCADE. "직접 완료 버튼을 눌렀다"와 구분돼야 감사 기록으로서 오해가 없다.
3. **어드민이 개입하지 않은 액션은 `actorId: null` + `origin: SYSTEM`.** 크론(LINE 리마인더 등), 그리고 인플루언서 행동이 유발한 자동 처리.

### 액터 귀속 규칙

| 케이스 | actorId | origin | 예 |
|---|---|---|---|
| 어드민 직접 액션 | 어드민 id | `ADMIN` | 승인 버튼, 캠페인 숨김 |
| 어드민 액션에 연쇄된 자동 처리 | 유발한 어드민 id | `CASCADE` | 제출물 승인 → 0엔 정산 자동완료 |
| 시스템/인플루언서 유발 자동 처리 | null | `SYSTEM` | 인사이트 제출 → 정산 생성·자동완료 |

주의: `ensureSettlementForApplication` 호출자는 **2곳**이다.

- `admin-applications.service.ts` `approveSubmission` — 어드민 승인 유발 → `CASCADE` + 승인자 id
- `influencer-applications.service.ts` 인사이트 제출 — 인플루언서 유발 → `SYSTEM` (승인은 과거에 이미 끝났으므로 그 승인자에게 귀속하지 않는다. `metadata.triggeredBy`로 유발 이벤트만 남긴다)

## 설계

### 1. Prisma 모델

```prisma
enum AdminActivityOrigin {
  ADMIN
  CASCADE
  SYSTEM
}

/// 어드민 도메인 액션의 append-only 감사 로그. 상태 컬럼(reviewedById 등)은
/// "현재 값", 이 테이블은 "누가 언제 무엇을 했는지"의 이력을 담당한다.
model AdminActivityLog {
  id     String              @id @default(cuid())
  /// AdminActivityAction (packages/shared zod enum) 값. Prisma enum 이 아닌
  /// String 인 이유: 액션 종류는 계속 늘어나는데 PostgreSQL enum 은 값 제거가
  /// 불가능해 마이그레이션 부채가 쌓인다. 유효성은 AuditService 시그니처
  /// (z.infer 유니온 타입)가 컴파일 타임에 보장한다.
  action String
  origin AdminActivityOrigin @default(ADMIN)

  /// 수행 어드민. SYSTEM 이면 null.
  actorId   String?
  /// 행위 시점의 어드민 이름 스냅샷 — 계정 삭제/개명 후에도 감사 기록 보존.
  actorName String?

  /// 대상 참조. FK 를 걸지 않는다 — 감사 로그는 도메인 row 의 삭제를 막아서도,
  /// 삭제에 딸려 지워져서도 안 된다. 참조는 "그 시점의 사실"이고, 사람이 읽을
  /// 문맥은 metadata 스냅샷이 담당한다.
  applicationId String?
  campaignId    String?
  settlementId  String?
  influencerId  String?

  /// 액션 부가 정보(사유, 변경 필드명, 유발 이벤트 등). PII(계좌번호·주소 등)
  /// 는 넣지 않는다.
  metadata Json?

  createdAt DateTime @default(now())

  /// 1차는 실제로 쿼리되는 2개만 만든다. campaignId/influencerId/actorId
  /// 인덱스는 해당 조회 API 를 붙이는 후속 작업에서 additive 마이그레이션으로
  /// 추가한다 — 미사용 인덱스는 매 INSERT 유지비만 낸다.
  @@index([applicationId, createdAt])
  @@index([createdAt])
  @@map("admin_activity_logs")
}
```

설계 포인트:

- **정산 로그에도 `applicationId`를 함께 넣는다.** 정산은 응모 단위 1건(`Settlement.applicationId @unique`)이므로 항상 알 수 있고, 이렇게 하면 응모 타임라인이 `WHERE applicationId = ?` **단일 인덱스 쿼리**로 완성된다(정산 로그를 별도 조인/합집합할 필요 없음).
- **FK 대신 스냅샷.** 기존 actor 컬럼의 "FK 없는 String" 문제는 dangling 시 정보가 소실되는 것이었는데, 여기서는 `actorName`·`metadata`가 사람이 읽을 문맥을 자체 보존하므로 id 가 dangling 이 돼도 감사 기록 가치가 유지된다. 도메인 모델 5개에 역참조 관계를 심지 않아 침습도도 낮다.
- **인덱스 = 성능 답변.** 응모건별 조회는 `(applicationId, createdAt)` 인덱스의 range scan 이라 테이블 총량과 무관하게 반환 행 수(응모당 수십 건)에만 비례한다. 전역 피드는 `(createdAt)` + cursor 페이지네이션.
- **actor 는 스냅샷만 읽는다.** 조회 응답의 `actor.name` 은 `actorName` 컬럼을 그대로 내려준다 — `AdminUser` 조인 없음. 어드민이 개명하면 과거 로그는 당시 이름으로 남는다(감사 기록으로서 의도된 동작).

### 2. shared 타입 (`packages/shared/src/types/adminActivity.ts`)

```ts
export const AdminActivityActionSchema = z.enum([
  // 응모
  "APPLICATION_APPROVE",
  "APPLICATION_REJECT",
  "APPLICATION_REVIEW_UNDO",
  "APPLICATION_SHIP",
  "APPLICATION_DELIVER",
  // 제출물
  "SUBMISSION_APPROVE",
  "SUBMISSION_REJECT",
  "SUBMISSION_REVIEW_UNDO",
  // 정산
  "SETTLEMENT_CREATE",
  "SETTLEMENT_REGISTER",
  "SETTLEMENT_COMPLETE",
  "SETTLEMENT_AUTO_COMPLETE",
  // 캠페인
  "CAMPAIGN_CREATE",
  "CAMPAIGN_UPDATE",
  "CAMPAIGN_CLOSE",
  "CAMPAIGN_HIDE",
  "CAMPAIGN_UNHIDE",
  "CAMPAIGN_DELETE",
  "CAMPAIGN_DRAFT_CREATE",
  "CAMPAIGN_DRAFT_UPDATE",
  "CAMPAIGN_DRAFT_PUBLISH",
  // 인플루언서
  "INFLUENCER_MEMO_CREATE",
  "INFLUENCER_FLAG_SET",
  "INFLUENCER_FLAG_CLEAR",
]);
export type AdminActivityAction = z.infer<typeof AdminActivityActionSchema>;

export const AdminActivityOriginSchema = z.enum(["ADMIN", "CASCADE", "SYSTEM"]);

export const AdminActivityLogSchema = z.object({
  id: z.string(),
  action: AdminActivityActionSchema,
  origin: AdminActivityOriginSchema,
  actor: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});
export type AdminActivityLog = z.infer<typeof AdminActivityLogSchema>;

export const ApplicationActivityResponseSchema = z.object({
  items: z.array(AdminActivityLogSchema),
});
export type ApplicationActivityResponse = z.infer<
  typeof ApplicationActivityResponseSchema
>;
```

### 3. AuditService (`apps/api/src/audit/`)

`audit.module.ts`(`@Global()`) + `audit.service.ts`. 새 도메인 디렉토리 신설이므로 기존 컨벤션(`<domain>/<domain>.service.ts`)을 따른다.

```ts
type AuditActor = { id: string; name: string | null };

type AuditEntry = {
  action: AdminActivityAction;
  origin?: AdminActivityOrigin; // 기본 ADMIN
  actor?: AuditActor | null;    // SYSTEM 이면 생략/null
  applicationId?: string;
  campaignId?: string;
  settlementId?: string;
  influencerId?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** best-effort: 기록 실패가 도메인 액션을 실패시키지 않는다. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.adminActivityLog.create({ data: toRow(entry) });
    } catch (error) {
      this.logger.error(`감사 로그 기록 실패: ${entry.action}`, error);
    }
  }

  /** 일괄 액션용 (정산 일괄 완료 등). createMany 1회. */
  async recordMany(entries: AuditEntry[]): Promise<void> { /* 동일 정책 */ }
}
```

- **인터셉터가 아니라 서비스 명시 호출**을 쓴다. 이유: ① HTTP 인터셉터는 연쇄 액션(0엔 자동완료)을 볼 수 없다 ② 핸들러 내부에서 결정되는 대상 id(생성된 settlementId 등)와 metadata 를 알 수 없다 ③ 기록 시점·조건을 액션별로 제어할 수 없다.
- `actorName`은 컨트롤러가 이미 들고 있는 `req.user`(=`PublicAdminUser`, `name` 포함)에서 받는다 — 추가 조회 없음. 서비스 시그니처는 `actorId: string` 대신 `actor: AuditActor`를 받도록 확장한다.
- 액션 유니온 타입이 시그니처에 있으므로 오타/미등록 액션은 컴파일 타임에 잡힌다.

### 4. 계측 대상과 코드 변경

#### 응모 (`admin-applications`)

| 액션 | 변경 | metadata |
|---|---|---|
| `APPLICATION_APPROVE`/`REJECT` | 서비스에 `audit.record` 추가 (actor 이미 전달됨 → `AuditActor`로 확장) | reject: `{ reason }` |
| `APPLICATION_REVIEW_UNDO` | 컨트롤러 `undo`에 `@Req()` 추가 + 서비스에 actor 전달. **비우기 전의 `reviewedById`를 `metadata.previousReviewerId`로 보존** — 현재의 "undo 가 검토자 정보를 소거하는" 문제를 로그가 해결 | `{ previousReviewerId }` |
| `APPLICATION_SHIP` | 컨트롤러 `ship`에 `@Req()` 추가 | `{ trackingCarrier, trackingNumber }` |
| `APPLICATION_DELIVER` | 컨트롤러 `deliver`에 `@Req()` 추가 | — |
| `SUBMISSION_APPROVE`/`REJECT`/`REVIEW_UNDO` | approve/reject 는 actor 전달 중 → record 추가. undo 는 `@Req()` 추가 + `previousReviewerId` 보존 | reject: `{ reason }` |

#### 정산

| 액션 | 변경 | 비고 |
|---|---|---|
| `SETTLEMENT_CREATE` / `SETTLEMENT_AUTO_COMPLETE` | `ensureSettlementForApplication` 반환을 `{ autoCompleted, createdSettlementId: string \| null }`로 확장(신규 생성 시에만 id). **기록은 호출자가 한다** — ensure-settlement 는 순수 함수 성격을 유지하고 AuditService 를 주입받지 않는다. `approveSubmission` 호출부는 `CASCADE`+승인자, `influencer-applications` 호출부는 `SYSTEM`+`metadata.triggeredBy: "INSIGHT_SUBMITTED"` | 자동완료 1건은 CREATE·AUTO_COMPLETE 로그 2행이 아니라 `SETTLEMENT_AUTO_COMPLETE` 1행으로 남긴다(생성 즉시 완료이므로) |
| `SETTLEMENT_REGISTER` | `settleSubmission` 컨트롤러에 `@Req()` 추가(현재 미수신) + 서비스에 actor 전달. 이 경로의 auto-complete 도 `Settlement.completedById` 를 함께 채운다(상태 컬럼 공백 보완) | `{ amountJpy, autoCompleted }`. 어드민이 누른 액션은 '등록' 하나이므로 0엔 즉시완료도 `SETTLEMENT_REGISTER` **1행**으로 남기고 자동완료 여부는 metadata 로 표기. 계좌정보 금지 |
| `SETTLEMENT_COMPLETE` | `completeSettlements`: 정산 건당 로그 1행(`recordMany`), 각 행에 `settlementId`+`applicationId` | `{ batchSize }` — 일괄 실행이었음을 표시 |

#### 캠페인 (`campaigns`, `campaign-drafts`) — 현재 완전 사각지대

- 컨트롤러 `create`/`update`/`close`/`hide`/`unhide`/`remove` + 드래프트 `create`/`update`/`publish` 전부에 `@Req() req: { user: AuthenticatedUser }` 추가, 서비스로 actor 전달, `audit.record`.
- `CAMPAIGN_UPDATE`의 metadata 는 **변경된 필드명 목록**만(`{ changedFields: [...] }`). 전체 before/after 스냅샷은 크기·민감정보 위험 대비 효용이 낮다.
- `Campaign` 모델에 actor 컬럼(`createdById` 등)을 **추가하지 않는다**. "누가 만들었나"는 로그 조회(`CAMPAIGN_CREATE` where campaignId)로 답한다. 상태 컬럼 하이브리드 원칙은 "화면이 상시 노출하는 현재 상태"에만 적용하는데, 캠페인 화면은 현재 그런 표시가 없다. 필요해지면 그때 additive 하게 추가.

#### 인플루언서 (`influencers`)

- `INFLUENCER_MEMO_CREATE`, `INFLUENCER_FLAG_SET`: actor 이미 전달 중 → record 만 추가.
- `INFLUENCER_FLAG_CLEAR`: 컨트롤러에 `@Req()` 추가 + `metadata.previousFlaggedById` 보존.
- 메모 로그의 `metadata.comment`는 넣지 않는다 — 본문은 `InfluencerMemo` 가 원본. `{ memoId, campaignId }` 참조만.

### 5. 조회 API + 타임라인 UI

- `GET /api/campaign-applications/:id/activity` → `ApplicationActivityResponse`. `AdminApplicationsController`(`@Controller("campaign-applications")`, 글로벌 prefix `api`)에 추가한다. 구현: `WHERE applicationId = :id ORDER BY createdAt DESC` (인덱스 커버). 응모당 로그가 수십 건 수준이라 페이지네이션 없이 전량 반환으로 시작한다.
  - 라우트 등록 순서 주의: 같은 컨트롤러에 `@Get("settlements")` 같은 리터럴 경로가 `:id` 뒤에 오는 기존 배치가 있다. `:id/activity` 는 세그먼트가 2개라 리터럴 단일 세그먼트와 충돌하지 않지만, 기존 `@Get(":id/submission")` 인근에 두어 순서 일관성을 유지한다.
- admin-web: 응모 상세(제출물 다이얼로그 또는 응모 행 확장)에 타임라인 섹션. §7 컨벤션대로 `useApplicationActivity.ts`(fetch hook) + `ActivityTimeline.tsx`(presentational) 분리. 액션 라벨 매핑은 `Record<AdminActivityAction, string>` — 전체 키 필수라 액션 추가 시 typecheck 가 누락을 잡는다.
- 캠페인별(`GET /api/campaigns/:id/activity`)·어드민별 활동 피드는 후속. API 와 함께 해당 인덱스(`(campaignId, createdAt)` 등)를 additive 마이그레이션으로 추가한다. 전역 피드는 반드시 cursor 페이지네이션(`createdAt, id`).

### 6. 퍼포먼스 판단 근거

- 응모건별 타임라인: 인덱스 range scan — 총 로그가 수천만 건이어도 해당 응모 구간만 읽는다. UI 요구사항에 대한 성능 리스크 없음.
- 쓰기: 액션당 INSERT 1건(일괄 완료는 `createMany` 1회). 어드민 액션 빈도(사람 손) 수준에서 무시 가능.
- 장기 볼륨: `createdAt` 기준 아카이빙/파티셔닝은 후속. append-only 라 언제든 뒤에서 붙일 수 있다.

## 에러 처리

- `AuditService.record`/`recordMany` 실패: 예외를 밖으로 던지지 않고 `Logger.error`. 도메인 액션의 성공/실패에 영향 없음.
- 조회 API: 대상 응모가 없으면 `NotFoundException`(메시지 한국어, §4 규칙).
- best-effort 의 트레이드오프(로그 유실 가능성)는 정책 결정 1번으로 수용. 금전 액션의 in-transaction 승격이 후속 과제.

## 테스트

- `audit.service.spec.ts` (신규): 정상 기록 / prisma 실패 시 예외를 삼키고 액션에 전파하지 않음 / `recordMany`.
- `ensure-settlement.spec.ts` (기존): 반환 확장(`createdSettlementId`) 반영 — 신규 생성/기존 존재/미충족 각 케이스.
- `campaigns.service.spec.ts` · `campaign-drafts.spec.ts` (기존): `create`/`update`/`close`/`hide`/`unhide`/`remove`/드래프트 메서드에 actor 파라미터가 추가되므로 호출부 수정 + prisma mock 에 `adminActivityLog.create` 추가.
- `influencer-applications.service.spec.ts` (기존): `ensureSettlementForApplication` 호출부에 `SYSTEM` 기록이 붙으므로 mock 에 `adminActivityLog.create` 추가.
- `admin-applications` 에는 **기존 spec 파일이 없다** — 이 도메인은 신규 spec 을 만들지 않고 `pnpm typecheck` + 수동 검증으로 진행한다. 계측 로직이 `audit.record` 호출 한 줄이라 별도 단위 테스트의 가치가 낮다.
- 각 단계에서 `pnpm typecheck` + 영향받는 spec 실행.
- 캠페인 계측: 컨트롤러 시그니처 변경이 admin-web 호출과 계약이 달라지지 않는지(요청 body 불변) typecheck 로 확인.

## 구현 순서 (다음 세션에서 이어서)

1. **기반**: Prisma 모델 + 마이그레이션(additive) → shared `adminActivity.ts` + index export + `pnpm --filter @jsure/shared build` → `AuditService`(+spec).
2. **계측 1 — 응모·정산**: `admin-applications`(approve/reject/undo/ship/deliver/submission·settle·complete) + `ensure-settlement` 반환 확장 + `influencer-applications` 호출부. 기존 spec 수정 동반.
3. **계측 2 — 캠페인**: `campaigns`·`campaign-drafts` 컨트롤러 `@Req()` 추가 + 서비스 record.
4. **계측 3 — 인플루언서**: memo/flag/flag-clear.
5. **조회 + UI**: activity 엔드포인트 → admin-web 타임라인.

각 단계는 독립 배포 가능(로그가 부분적으로만 쌓여도 무해). 1→2 만으로도 "정산·응모 누가 했는지"의 최우선 요구가 충족된다.

## 사이드이펙트

- 마이그레이션은 테이블·enum **추가만**(additive). 기존 테이블 무변경 — 배포 순간 구버전 코드와 공존 가능.
- 기존 API 계약(요청/응답 모양) 불변 — 컨트롤러에 `@Req()` 추가는 클라이언트에 비가시적. admin-web 재배포는 타임라인 UI(5단계) 전까지 불필요.
- `ensureSettlementForApplication` 시그니처(반환) 변경 → 호출부 2곳 + spec 수정. `autoCompleted` 의미는 불변이라 캠페인 종료 메시지 발송 로직에 영향 없음.
- `settleSubmission` auto-complete 경로가 `completedById`를 채우기 시작 → 기존 null 데이터와 혼재하나 조회 측은 nullable 전제라 무해.
- 계측 누락은 컴파일 에러로 잡히지 않는다(호출을 안 하면 그만이므로). 새 어드민 mutation 엔드포인트 추가 시 감사 로그 기록을 함께 넣는 것을 리뷰 체크 항목으로 삼는다.
- 배포: api(Railway, 마이그레이션 포함) 먼저. admin-web(Vercel)은 5단계에서.
