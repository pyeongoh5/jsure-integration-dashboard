/**
 * 다음(카카오) 우편번호 서비스 응답 → 우리 주소 컬럼.
 * DOM 에 의존하지 않는 순수 변환이라 shared 에 두고 테스트한다.
 */

/** 다음 우편번호 서비스가 넘기는 값 중 우리가 쓰는 것만. */
export type DaumPostcodeData = {
  zonecode: string;
  sido: string;
  sigungu: string;
  roadAddress: string;
  buildingName: string;
};

export type KrAddressResult = {
  /** 5자리 우편번호. */
  postalCode: string;
  /** 시·도 약칭. 다음이 주는 값 그대로 ("서울", "경기"). */
  prefecture: string;
  /** 시·군·구. 세종특별자치시처럼 하위 행정구역이 없으면 빈 문자열이다. */
  city: string;
  /** 도로명 주소에서 시·도와 시·군·구를 뗀 나머지. */
  addressLine1: string;
};

/**
 * roadAddress 는 "서울 강남구 테헤란로 123" 처럼 시·도와 시·군·구를 포함한다.
 * 컬럼이 셋으로 나뉘어 있으므로 접두를 떼어 중복 저장을 막는다.
 * 접두가 예상과 다르면(도로명 주소가 없는 지역 등) 원본을 그대로 쓴다.
 *
 * 세종특별자치시는 시·군·구가 없어 sigungu 가 빈 문자열로 온다. 이때 접두를
 * `"세종특별자치시  "`(공백 2개)로 만들면 어디에도 걸리지 않아 시·도가 도로명에
 * 중복으로 남는다 — 빈 조각은 빼고 이어 붙인다.
 */
export function toKrAddress(data: DaumPostcodeData): KrAddressResult {
  const prefix = `${[data.sido, data.sigungu].filter(Boolean).join(" ")} `;
  const withoutPrefix = data.roadAddress.startsWith(prefix)
    ? data.roadAddress.slice(prefix.length)
    : data.roadAddress;

  return {
    postalCode: data.zonecode,
    prefecture: data.sido,
    city: data.sigungu,
    // 건물명이 있으면 함께 남긴다 — 배송 라벨에서 동/호수만으로는 찾기 어렵다.
    addressLine1: data.buildingName
      ? `${withoutPrefix} (${data.buildingName})`
      : withoutPrefix,
  };
}
