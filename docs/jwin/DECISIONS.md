# 결정 로그 (요건정의서 §6 / §부록 B 대응)

| # | 항목 | 결정 | 근거 | 일자 |
|---|---|---|---|---|
| D-1 | 리포스트 매칭 범위 | **당일(JST) 게시 포스트만 인정** | 매일 재응모 유도 구조와 일치. Entry가 당일 CampaignPost에 귀속됨 | 2026-07-23 |
| D-2 | 검증 시점·실패 처리 | **lazy 검증 (당첨 후보만)** + 실패 시 사유(follow/repost) 안내 후 당일 응모 화면에서 재시도. **홀드·재고 회수 없음** | API 비용·레이트리밋 최소화. 60분 홀드·몰수(WIN_FORFEITED)·슬롯 회수 잡은 운영 복잡도 대비 실익이 없어 폐지 — 재고는 추첨 시점 차감을 유지하고, 당일 내 미검증 건은 미이행 종료로 통계에만 반영 | 2026-07-23 (개정 2026-07-26) |
| D-3 | 추첨 로직 | **확률 + 원자적 재고 차감** (+ 캠페인별 일별 당첨 상한 옵션) | 구현 단순, 운영자가 직관적으로 조정 가능 | 2026-07-23 |
| D-4 | 기프트코드 전달 | **브랜드 계정 DM 자동 발송** (실패 시 5분 주기 재시도) | 종량제 DM $0.015/건으로 비용 무시 가능. 스파이크로 개방 여부 실측 필요 | 2026-07-23 |
| D-5 | 검증 수단 | **유저 본인 OAuth 토큰으로 owned read 조회** (connection_status 1콜 + 본인 tweets 스캔) | $0.001 단가 + 유저별 레이트리밋으로 수평 확장. retweeted_by(75req/15min) 회피 | 2026-07-23 |
| D-6 | 스택/인프라 | TypeScript 모노레포. Vercel(web) + Railway(api, 단일 인스턴스) + Neon(pg) | 발주측 기존 운영 경험 스택 | 2026-07-23 |
| D-7 | X API 요금 전제 | 종량제(pay-per-use): 포스트 $0.015(URL 포함 $0.20), 읽기 $0.005~0.01, owned read $0.001, DM $0.015, 월 2M 읽기 캡 | 공식 문서 + 2026-04-20 개편 공지. **계약 전 Developer Console에서 최종 확인** | 2026-07-23 |
| D-8 | 캠페인 구성 단위 | **Round(회차) 폐지 → 캠페인 기간 단위**. 기간(startsAt/endsAt)·slug·상태를 `BrandCampaign`으로 통합하고, 응모는 캠페인별 단독 LP `/c/{slug}`, 진행 중 목록은 별도 페이지 `/campaigns` | 라운드 = 복합 LP 구조가 실제 운영(브랜드별 개별 계약·기간·소재)과 어긋남. RoundStatus + CampaignStatus 이중 상태 관리를 `CampaignStatus` 하나로 줄여 운영·구현 모두 단순화 | 2026-07-26 |
| D-9 | 미디어 첨부 포스팅 | **v1 필수로 승격.** `PostTemplate.mediaUrl`을 X v2 chunked media upload로 올린 뒤 `media_ids`로 첨부 | Atatter 대조 결과 이미지·동영상 없는 캠페인 포스트는 실사용이 어렵다고 판단. 업로드 자체는 무과금이라 비용 영향 없음 | 2026-07-26 |
| D-10 | 어드민 인증·화면 | **대시보드(@jsure/api + admin-web)와 통합.** J-WIN은 어드민 계정도 로그인 엔드포인트도 갖지 않는다. 대시보드가 발급한 access token을 jwin-api가 동일한 `JWT_SECRET`으로 서명 검증(stateless)하고, 화면은 `@jsure/admin-web`에 J-WIN 모듈로 붙인다. `AdminUser` 모델 폐기, `AuditLog`는 대시보드 유저 id/email을 FK 없이 값으로 보관 | 운영자가 J-sure 단일 조직인데 로그인·계정 관리를 이중화할 이유가 없다. DB를 분리한 채로 인증만 공유할 수 있는 이유는 대시보드 JWT가 stateless(HS256)여서 서명 검증에 DB가 필요 없기 때문. **트레이드오프**: 두 서비스가 `JWT_SECRET`을 공유하므로 로테이션 시 동시 배포가 필요하고, 대시보드에서 세션을 폐기해도 이미 발급된 access token은 만료(기본 15분)까지 jwin-api에서 통과한다 | 2026-07-26 |
| D-11 | 어드민 API 계약 | **jwin-shared 공유 zod.** `packages/jwin-shared`에 어드민 응답/요청 zod 스키마를 두고 jwin-api가 그 모양으로 매핑 반환, admin-web은 `.parse()`. `winners` 응답에서 `encryptedShipping` 제거, 배송지는 전용 엔드포인트로 분리(열람 감사) | 대시보드 `@jsure/shared` 관례·CODE_RULES §2와 일치. 서버·프론트 단일 계약 소스로 드리프트 차단. jwin-api는 이미 zod 사용 중이라 도입 부담 낮음 | 2026-07-26 |
| D-12 | 미디어 업로드 | **대시보드 R2 재사용.** `apps/api`에 J-WIN용 presign 엔드포인트 1개 추가, `R2_PUBLIC_BASE_URL`로 만료 없는 공개 URL 발급. admin-web이 업로드 후 최종 공개 URL만 `mediaUrl`로 저장 → jwin-api는 R2 미접촉 | 대시보드 R2 presign/publicUrl 인프라 기존재. jwin-api가 게시 시각마다 fetch하므로 만료 URL이면 후반 게시가 조용히 실패 — 공개 URL 필수. 새 스토리지 운영 회피 | 2026-07-26 |

## 열린 항목 (v1 확정 전 결정 필요)

- 배송지 개인정보 보존 기간·삭제 배치 (일본 APPI 검토와 함께)
- 낙첨/당첨 이미지 등 LP 디자인 소재 (독자 제작 — 전제조건 §2-2)
- 리포스트 취소 후 재응모 어뷰징: 당일 1회 제약으로 1차 방어. 추가 정책 필요 여부
