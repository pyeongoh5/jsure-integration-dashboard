# SNS 단위 캠페인 제외(디펜던시) 설계

작성일: 2026-06-12

## 배경 / 문제

캠페인 제외(디펜던시) 기능은 "캠페인 E에 응모하려는 인플루언서가, E가 지정한
금지 캠페인(A, B…)에 이미 응모한 적이 있으면 응모를 막는다" 는 기능이다.

현재 구현은 **캠페인 단위(전체 차단)** 다. 즉 인플루언서가 금지 캠페인에
어떤 SNS로든 응모했으면 E에 대한 **모든 SNS 응모가 차단**된다.

요구사항: 차단은 **같은 SNS 기준**이어야 한다.
예) E가 A를 금지로 지정했고 인플루언서가 A에 **인스타**로 응모했다면,
E의 **인스타 응모만** 막히고 E의 다른 SNS(틱톡 등)에는 응모할 수 있어야 한다.

## 범위

- 제외 **설정**은 그대로 캠페인 단위로 유지한다 (E가 A를 금지). 관리자
  `ExcludedCampaignsPicker` UI 및 `CampaignExclusion` 데이터 모델은 변경 없음.
- **차단 로직**과 **인플루언서 화면 표시**만 SNS 단위로 바뀐다.
- DB 마이그레이션 불필요.

## 데이터 모델

변경 없음. `CampaignExclusion { campaignId, excludedCampaignId }` 유지.

## 1) 백엔드 차단 — `influencer-applications.service.create()`

현재: `excludedCampaignIds` 중 하나라도 취소 제외 응모가 있으면 `findFirst` 후
전체 응모를 차단.

변경: 같은-SNS 매칭으로 교체.

- E의 `excludedCampaignIds` 에 대해 인플루언서의 취소 제외 응모를 조회하되
  `snsType` 기준으로 `distinct` 하여 `excludedSnsTypes`(금지 캠페인에 응모할 때
  쓴 SNS) 집합을 만든다.

  ```ts
  const priorOnExcluded = await this.prisma.campaignApplication.findMany({
    where: {
      influencerId,
      campaignId: { in: excludedCampaignIds },
      status: { not: "CANCELLED" },
    },
    select: { snsType: true },
    distinct: ["snsType"],
  });
  const excludedSnsTypes = new Set(priorOnExcluded.map((row) => row.snsType));
  ```

- 요청한 SNS 검증 단계(`qualifyingSet` 검사 부근)에서, 요청 `snsType` 중
  `excludedSnsTypes` 에 포함된 것이 있으면 해당 SNS를 명시하여
  `EXCLUDED_BY_PREVIOUS_APPLICATION` 예외를 던진다.

  ```ts
  const blocked = snsTypes.filter((snsType) => excludedSnsTypes.has(snsType));
  if (blocked.length > 0) {
    throw new BadRequestException({
      code: "EXCLUDED_BY_PREVIOUS_APPLICATION",
      message: "同種のキャンペーンに既に応募済みのため、このSNSでは応募できません",
    });
  }
  ```

- **거부 정책:** 응모 화면이 제외 SNS를 비활성화하므로, 제외 SNS가 제출되는
  것은 비정상 케이스다. 따라서 백엔드는 (일부만 건너뛰지 않고) 요청을 **거부**한다.
  이는 기존 `SNS_NOT_QUALIFIED` 검증과 동일한 방어적 패턴이다.

## 2) API 계약 — `packages/shared/src/types/campaign.ts`

`InfluencerCampaignDetailSchema` 에만 필드 추가:

```ts
/** 이 인플루언서가 과거 응모 이력 때문에 이 캠페인에서 응모할 수 없는 SNS */
excludedSnsTypes: z.array(SnsTypeSchema),
```

카드 스키마(`InfluencerCampaignCardSchema`)는 변경하지 않는다. 응모 가부는
상세/응모 화면에서만 필요하다. 변경 후 `pnpm --filter @jsure/shared build`.

## 3) 인플루언서 상세 서비스 — `influencer-campaigns.service`

인플루언서별 캠페인 상세를 만들 때 `excludedSnsTypes` 를 계산한다.

- 캠페인의 `excludedCampaignIds` 를 가져온다.
- 인플루언서의 취소 제외 응모 중 위 금지 캠페인에 해당하는 것을 `snsType`
  distinct 로 조회한다.
- 캠페인이 실제 모집하는 SNS와 교집합만 남겨 `excludedSnsTypes` 로 반환한다.
  (모집하지 않는 SNS는 표시 의미가 없으므로 제외)

`appliedSnsTypes` 를 계산하는 기존 로직과 같은 자리에 둔다.

## 4) 응모 화면 — `apps/client-web/src/pages/Apply/index.tsx`

- `campaign.data.excludedSnsTypes` 를 읽는다.
- SNS 행에서 세 번째 비활성화 사유 추가:
  `disabled = !isQualifying || alreadyApplied || isExcluded`.
- 제외된 행에는 `応募済み` 라벨과 같은 위치에 사유 라벨 표시
  (예: 「参加不可」 + 「類似キャンペーンに応募済み」).

## 5) `CampaignDetail` 페이지

CTA(`応募する`)는 현 상태 유지. `appliedSnsTypes.length < snsRecruits.length`
조건상, 남은 SNS가 모두 제외인 경우 응모 화면에 들어가도 선택 가능한 SNS가
없을 수 있다. 드문 엣지 케이스이며 이번 범위에서는 응모 화면의 비활성화 표시로
충분하다. (추후 필요 시 CTA에 excluded 반영)

## 테스트

- `create()` 시나리오 테스트: 금지 캠페인 A에 인스타로 응모한 인플루언서는
  E-인스타 응모 시 `EXCLUDED_BY_PREVIOUS_APPLICATION` 으로 차단되고,
  E-틱톡 응모는 정상 생성된다.
- 리포지토리에 prisma mock 기반 서비스 테스트 패턴이 없으므로, 가능한 범위에서
  실제 DB 시드/스크립트 기반으로 동작을 확인하고 `pnpm typecheck` 로 정합성 검증.

## 영향 범위 요약

| 레이어 | 파일 | 변경 |
|---|---|---|
| shared | `packages/shared/src/types/campaign.ts` | `excludedSnsTypes` 필드 추가 |
| api (차단) | `influencer-applications/influencer-applications.service.ts` | 같은-SNS 매칭 차단 |
| api (상세) | `influencer-campaigns/influencer-campaigns.service.ts` | `excludedSnsTypes` 계산 |
| client | `apps/client-web/src/pages/Apply/index.tsx` | 제외 SNS 비활성화 + 사유 |

데이터 모델/마이그레이션: 변경 없음.
