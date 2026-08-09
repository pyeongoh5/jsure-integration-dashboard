# 한국 주소·계좌 입력 지원 설계

## 배경 / 문제

인플루언서의 주소와 계좌는 일본 형식만 받는다. 주소는 7자리 우편번호 + 47 도도부현, 계좌는 4자리 금융기관 코드 + 지점명 + 7자리 계좌번호 + カナ 예금주명이다.

한국 거주 인플루언서가 한국 주소와 한국 계좌를 쓰고 싶다는 요구가 있다. 지금 구조로는 입력할 방법이 없다.

## 목표

회원가입과 마이페이지에서 주소·계좌를 **한국 또는 일본 형식 중 하나로 선택해** 입력한다.

- 활성 주소는 하나, 활성 계좌는 하나. 두 나라 값이 동시에 존재하지 않는다.
- 주소와 계좌의 국가는 **서로 독립**이다. 한국 주소 + 일본 계좌 조합이 허용된다.
- 국가를 전환하면 해당 폼의 기존 값이 지워진다는 안내를 먼저 보여준다.

## 비목표

- 두 나라 주소·계좌를 동시에 보관하지 않는다.
- 해외송금용 영문 성명·SWIFT 코드 없음. 실제 송금 수단은 운영에서 처리한다.
- 국가 추가(제3국) 없음.

## 설계

### 1. 데이터 모델

**국가 컬럼 3개 추가** (모두 default `JP`, additive)

| 테이블 | 컬럼 |
|---|---|
| `influencers` | `addressCountry` (`JP` \| `KR`) |
| `influencer_bank_accounts` | `bankCountry` (`JP` \| `KR`) |
| `settlements` | `bankCountry` — 계좌 스냅샷의 일부 |

`settlements`에 넣는 이유는 정산 시점 계좌가 어느 나라 것이었는지 남지 않으면 스냅샷의 의미가 없기 때문이다. 기존 행은 default `JP`로 채워진다.

**컬럼 rename**: `accountHolderKana` → `accountHolder` (`influencer_bank_accounts`, `settlements`).

`Kana`는 일본 은행이 이체 대조에 쓰는 カタカナ 표기를 뜻해 한국 계좌에는 맞지 않는다. 데이터 변환이 없는 `RENAME COLUMN` 2줄이고, 이 컬럼은 인덱스·외래키·뷰·원시 SQL 어디에도 걸려 있지 않다. 위험은 마이그레이션 적용 후 새 코드가 뜨기 전까지 구 컨테이너가 실패하는 짧은 배포 틈뿐이다.

**기존 컬럼 재해석**

| 컬럼 | 일본 | 한국 |
|---|---|---|
| `postalCode` | 123-4567 (7자리) | 12345 (5자리) |
| `prefecture` | 都道府県 (47개 enum) | 시/도 17개 — 다음 API 의 `sido` 약칭 ("서울") |
| `city` | 市区町村 | 시·군·구 |
| `addressLine1` | 番地 | 도로명 주소 |
| `addressLine2` | 建物名·部屋番号 | 상세 주소 |
| `bankCode` | 4자리 (`JP_BANKS`) | 3자리 (`KR_BANKS`) |
| `bankName` | 銀行名 | 은행명 |
| `branchName` / `branchCode` | 필수 / 선택 | 빈 문자열 (한국은 지점 무관) |
| `accountNumber` | 7자리 숫자 | 은행별 자유 형식 (숫자·하이픈) |
| `accountHolder` | カナ 예금주 | 예금주명 (한글) |
| `invoiceRegistrationNumber` | 선택 | 미사용 (null) |

한국에도 금융기관 표준코드(3자리)가 있어 은행을 목록에서 고르게 한다. 자유 입력으로 두면 "국민은행"/"KB국민은행"/"국민" 같은 표기 흔들림이 남는다.

### 2. 공유 스키마와 검증

국가 구분은 **discriminated union**으로 둔다. 하나의 object에 optional을 늘리면 "한국인데 지점명이 들어온" 조합을 막을 수 없다.

```ts
export const AddressCountrySchema = z.enum(["JP", "KR"]);

const JpAddressSchema = z.object({
  country: z.literal("JP"),
  postalCode: /* 7자리, 기존 그대로 */,
  prefecture: JpPrefectureSchema,   // 47개
  city, addressLine1, addressLine2,
});

const KrAddressSchema = z.object({
  country: z.literal("KR"),
  postalCode: z.string().regex(/^\d{5}$/, "우편번호는 5자리 숫자"),
  prefecture: KrProvinceSchema,     // 17개 시/도
  city, addressLine1, addressLine2,
});

export const InfluencerAddressSchema = z.discriminatedUnion("country", [
  JpAddressSchema,
  KrAddressSchema,
]);
```

계좌도 같은 모양이다. 한국 계좌 스키마에는 `branchName`·`branchCode`·`invoiceRegistrationNumber`가 **아예 없다**. API가 저장할 때 일본 전용 컬럼을 빈 문자열·null로 채운다.

변환은 `apps/api/src/common/account-columns.ts` 한 곳에 모은다. 국가 전환 시 이전 국가의 잔여 값이 남지 않으려면 저장이 항상 전체 컬럼을 덮어써야 하는데, 이 규칙을 서비스마다 반복하면 한 곳만 빠뜨려도 값이 남는다. 회원가입·LINE 가입·마이페이지 세 경로가 같은 함수를 쓴다.

**폼 검증은 union 대신 `superRefine`을 쓴다.** react-hook-form 은 필드별 에러 경로가 있어야 각 입력 아래에 메시지를 붙이는데, `discriminatedUnion` 은 실패 시 판별자 위치로 에러를 모아 개별 필드 메시지가 사라진다. 서버는 union 그대로 검증하고, 클라이언트만 같은 규칙을 `superRefine` 으로 표현한다.

**새 상수 2개**: `packages/shared/src/data/krBanks.ts`의 `KR_BANKS`(1금융권·인터넷은행·주요 증권사, `JP_BANKS`와 같은 `{ code, name }` 모양), `KR_PROVINCES`(17개 시/도).

응답 스키마에도 `country`가 실려 나간다. 어드민·마이페이지가 이 값으로 라벨과 표시 형식을 고른다.

### 3. 인플루언서 웹

**컴포넌트 구조.** `AddressFormFields.tsx`(257줄)에 국가 분기를 얹으면 필드마다 삼항이 반복된다. 디렉터리로 쪼갠다:

```
domains/me/components/address/
  index.tsx                 — 국가 토글 + 전환 확인 + 국가별 컴포넌트 선택
  JpAddressFields.tsx       — 우편번호 자동조회(zipcloud) + 47 도도부현
  KrAddressFields.tsx       — 다음 우편번호 검색 + 상세주소 입력
  KrManualAddressFields.tsx — 검색 스크립트 로드 실패 시의 폴백
  PostcodeSearchDialog.tsx  — 다음 검색 레이어
```

### 3-1. 한국 주소는 다음(카카오) 우편번호 서비스로 입력한다

키가 필요 없고 무료다. 사용자는 **주소 검색 → 상세 주소 입력** 두 단계만 밟고, 우편번호·시도·시군구·도로명은 검색 결과로 채워지는 읽기 전용 칸이 된다. 한국 주소 폼의 관행이기도 하다.

**저장 값을 API 응답에 맞춘다.** `KR_PROVINCES`는 다음이 주는 `sido` 약칭("서울", "경기")을 그대로 쓴다. 정식 명칭으로 두면 매핑이 필요하고, 매핑이 어긋나는 순간 검증에서 거부된다.

| 다음 API | 우리 컬럼 |
|---|---|
| `zonecode` | `postalCode` |
| `sido` | `prefecture` |
| `sigungu` | `city` |
| `roadAddress` − `sido sigungu` 접두 | `addressLine1` (건물명이 있으면 괄호로 덧붙임) |
| (사용자 입력) | `addressLine2` |

접두를 떼는 이유는 컬럼이 셋으로 나뉘어 있어 그대로 담으면 어드민 CSV 에서 시·도와 시·군·구가 두 번 나오기 때문이다. 세종시처럼 `sigungu` 가 비는 지역이 있어 접두가 예상과 다르면 원본을 그대로 쓴다.

**팝업이 아니라 레이어(embed)로 띄운다.** 인플루언서 웹은 LINE 인앱 브라우저에서 열릴 수 있고, 인앱 브라우저는 `window.open` 을 막는 경우가 있다.

**스크립트 로드 실패 시 수동 입력으로 되돌린다.** 읽기 전용 칸만 남으면 주소를 아예 넣을 수 없어 **회원가입이 막힌다**. 실패 원인은 대부분 사용자 네트워크(방화벽·보안 소프트웨어)라 재시도로 풀리지 않는다. 폴백은 시/도 select 를 포함한 기존 폼이라 새로 짤 코드가 없다.

변환 함수 `toKrAddress` 는 DOM 에 의존하지 않는 순수 함수라 `packages/shared/src/utils/krAddress.ts` 에 두고 api 의 jest 로 검증한다 — client-web 에는 테스트 러너가 없다.

계좌도 같다. `Signup/Bank.tsx`(312줄)와 `Me/Bank.tsx`(262줄)가 필드 마크업을 각자 들고 있으므로 `domains/me/components/bank/`로 공통 필드를 뽑고 두 화면은 저장 로직만 갖는다.

`BankSelect`는 `banks` prop을 받도록 넓힌다 — 검색·무한스크롤 로직이 목록과 무관해 국가별 컴포넌트를 새로 만들 이유가 없다.

**국가 전환과 초기화 안내.** 토글을 누르면 확인 다이얼로그를 먼저 띄운다.

> 일본 주소로 전환하면 입력하신 한국 주소가 모두 지워집니다. 계속하시겠습니까?

확인하면 폼 값을 전부 비우고 국가를 바꾼다. **입력값이 하나도 없으면 다이얼로그 없이 바로 전환**한다 — 지울 게 없는데 묻는 건 방해다. 주소와 계좌는 독립이라 한쪽을 바꿔도 다른 쪽은 그대로다.

저장은 기존 엔드포인트를 그대로 쓴다. 요청 본문에 `country`가 실리고, 서버가 union으로 검증한 뒤 일본 전용 컬럼을 정리한다. 국가가 바뀌는 저장에서 이전 국가의 잔여 값이 남지 않도록 **저장 시 항상 전체 필드를 덮어쓴다**.

모든 문자열은 i18n 처리하고, 신규 property 에는 `// new` 주석을 단다.

### 4. 어드민

어드민에는 인플루언서의 주소·계좌를 항목별로 보여주는 상세 화면이 없다. 주소는 승인자 명단에서 한 줄 문자열로만 나오고(국가와 무관하게 그대로 동작한다), 계좌는 정산 화면의 표에만 나온다. 그래서 변경은 세 곳이다.

- 정산 화면 표에 `계좌 국가` 열을 추가한다. 한국 계좌는 지점·인보이스가 빈 값이므로 `—`로 표시한다.
- 인플루언서 CSV에 `주소 국가` 열을, 정산 CSV에 `계좌 국가` 열을 추가한다. 운영자가 송금 수단을 나눠야 하므로 필터·정렬의 근거가 된다.
- 정산 화면·CSV의 계좌 국가는 스냅샷의 `bankCountry`를 따른다. 스냅샷 도입 전 정산 건은 `null`이므로 일본으로 간주한다.

## 에러 처리

- 국가와 맞지 않는 값(한국인데 7자리 우편번호 등)은 zod union에서 걸린다. 클라이언트가 국가별 스키마로 먼저 막고, 서버가 같은 스키마로 다시 검증한다.
- 기존 데이터는 전부 `JP`이므로 파싱 실패가 없다.
- `KR_BANKS`에 없는 은행 코드는 저장되지 않는다(목록 선택만 허용).

## 테스트

- **shared**: union 스키마 단위 테스트 — 한국 우편번호 5자리 통과·7자리 거부, 한국 계좌 스키마가 지점명을 받지 않음, 일본 스키마는 기존 검증 유지.
- **api**: 국가 전환 저장 시 이전 국가 값이 빈 값·null로 정리되는지, `ensure-settlement` 스냅샷에 `bankCountry`가 담기는지.
- **다음 응답 변환**: 접두 제거, 건물명 덧붙임, 접두가 어긋나는 경우 원본 유지.
- **클라이언트**: 테스트 인프라가 없어 `pnpm typecheck`에 의존한다. union 도입으로 국가별 분기 누락이 타입 에러로 드러난다.

## 마이그레이션

롤백 단위를 작게 두기 위해 2개로 나눈다.

1. `accountHolderKana` → `accountHolder` rename (`influencer_bank_accounts`, `settlements`)
2. 국가 컬럼 3개 추가 (default `JP`)

기존 행은 default로 채워지므로 백필이 필요 없다.

## 사이드이펙트

- `accountHolder` rename은 API 응답 필드명을 바꾼다. **api → admin-web·client-web** 순서로 배포하지 않으면 웹이 파싱에 실패한다.
- 응답에 `country`가 필수로 추가되므로 같은 배포 순서 제약을 받는다.
- 정산 CSV의 열이 늘어난다. 기존 열 순서는 유지하고 뒤에 붙인다.
- 다음 우편번호 스크립트는 `t1.daumcdn.net` 에서 받는다. 나중에 CSP 를 도입하면 이 도메인을 허용해야 한다.
- 한국 계좌는 일본 국내이체 수단으로 송금할 수 없다. 실제 지급 방법은 운영에서 별도로 처리해야 하며, 이 설계는 정보 수집까지만 다룬다.
