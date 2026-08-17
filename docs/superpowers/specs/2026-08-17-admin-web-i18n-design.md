# admin-web 다국어(i18n) 시스템 설계

날짜: 2026-08-17
대상: `apps/admin-web` — 한국어(ko) / 영어(en) / 일본어(ja) 3개 언어 지원

## 배경과 결정 사항

- client-web은 루트 `/i18n`의 커스텀 시스템(`t(key)`, `{kr, jp}` 리프, `VITE_I18N_REGION` 빌드타임 고정)을 사용 중.
- admin-web은 문자열이 전부 한국어 하드코딩 상태 (tsx 95개 파일, 14개 페이지 그룹).
- 결정:
  - **런타임 언어 전환** — 관리자가 헤더에서 직접 전환, localStorage 저장.
  - **전체 일괄 마이그레이션** — 95개 파일의 문자열을 이번 작업에서 모두 교체.
  - **번역은 Claude가 직접 작성** — ko/en/ja 3개 언어를 마이그레이션과 동시에 채움.
  - **루트 `/i18n`을 client/admin 서브디렉토리로 재편** — 코어 타입과 validate 스크립트 공유. i18next는 도입하지 않음(런타임 전환 외에 얻는 것이 없고, 기본 상태에서 키 오타가 조용히 화면에 노출되는 fallback 동작이 현재의 컴파일 에러 + throw 방식보다 나쁨).

## 디렉토리 구조

```
i18n/
  index.ts              # 기존 그대로 client 재수출 → client-web은 import 무변경
  core.ts               # DotPath 타입 유틸 (client/admin 공유)
  client/
    messages.ts         # 기존 messages.ts 이동 ({kr, jp} 리프 그대로)
    t.ts                # 기존 t.ts 이동 (VITE_I18N_REGION 빌드타임 방식 유지)
  admin/
    messages.ts         # 신규. 리프 = { ko: string; en: string; ja: string }
    index.ts            # translate(key, language, params?) + AdminTranslationKey 타입
  scripts/
    validate-i18n.ts    # locale 목록을 파라미터로 받도록 일반화, client·admin 둘 다 검증
```

## admin-web 런타임 레이어

파일: `apps/admin-web/src/lib/i18n.tsx`

- `LanguageProvider`: React Context + `useState`. 초기값은 `localStorage("admin-language")`, 유효하지 않으면 `ko` 폴백. 변경 시 localStorage 저장, state 변경으로 전체 리렌더.
- `useT()`: 현재 언어가 바인딩된 `t(key, params?)`를 반환. 키 오타는 `AdminTranslationKey` 타입으로 컴파일 에러.
- `useLanguage()`: 현재 언어와 setter — 전환 드롭다운에서 사용.
- 보간: 메시지의 `{name}` 플레이스홀더를 `params`로 치환. 한·영·일 어순 차이 때문에 문자열 조립(concat) 금지, 변수가 들어가는 문장은 전부 보간으로 처리.
- React 밖(axios 인터셉터, zod 스키마 등)에서는 `i18n/admin`의 `translate(key, getStoredLanguage(), params?)`를 직접 호출.

## 언어 전환 UI

- 관리자 레이아웃 헤더에 드롭다운 1개: `한국어 / English / 日本語`.
- 별도 설정 페이지 없음.

## 마이그레이션 범위

- admin-web src의 모든 하드코딩 한국어 UI 문자열을 `t()` 키로 교체.
- 키 네이밍: 도메인 기준 dot-path — `pages.applicants.title`, `components.dataTable.empty` 등.
- 상태 enum 라벨 맵(지원 상태, 정산 상태 등)도 전부 키로 이동.
- **제외 대상**:
  - API 서버가 내려주는 에러 메시지 (서버는 한국어 유지 — 기존 규칙)
  - 데이터 자체 (브랜드명, 캠페인명 등 DB 값)
  - 로그, 코드 주석

## 검증

- `validate-i18n.ts`: 리프마다 해당 트리의 모든 언어(client: kr/jp, admin: ko/en/ja)가 비어있지 않은지 검사. 실패 시 exit 1.
- admin-web `build` 스크립트 앞단에 validate 연결 (client-web과 동일 패턴).
- 완료 판정:
  - admin-web src 한글 리터럴 grep 스캔 잔여 0건 (제외 대상 제외)
  - `pnpm typecheck` / `pnpm build` (admin-web, client-web 모두) 통과

## 오류 처리

- 존재하지 않는 키: DotPath 타입으로 컴파일 에러 — 런타임 도달 불가.
- 번역 누락: 빌드 전 validate 실패 — 런타임 도달 불가.
- localStorage 값 이상: `ko` 폴백.
