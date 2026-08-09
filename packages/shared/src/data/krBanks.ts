/**
 * 한국 금융기관 표준코드(3자리)와 명칭.
 * 국내 계좌이체에 쓰이는 코드로, 자유 입력 시 생기는 표기 흔들림
 * ("국민은행"/"KB국민은행"/"국민")을 막기 위해 목록에서 선택하게 한다.
 * JP_BANKS 와 같은 모양이라 BankSelect 가 그대로 재사용된다.
 */
export type KrBank = { code: string; name: string };

export const KR_BANKS: readonly KrBank[] = [
  // 은행
  { code: "002", name: "KDB산업은행" },
  { code: "003", name: "IBK기업은행" },
  { code: "004", name: "KB국민은행" },
  { code: "007", name: "수협은행" },
  { code: "011", name: "NH농협은행" },
  { code: "012", name: "지역농축협" },
  { code: "020", name: "우리은행" },
  { code: "023", name: "SC제일은행" },
  { code: "027", name: "한국씨티은행" },
  { code: "031", name: "iM뱅크(대구)" },
  { code: "032", name: "부산은행" },
  { code: "034", name: "광주은행" },
  { code: "035", name: "제주은행" },
  { code: "037", name: "전북은행" },
  { code: "039", name: "경남은행" },
  { code: "045", name: "새마을금고" },
  { code: "048", name: "신협" },
  { code: "050", name: "저축은행" },
  { code: "064", name: "산림조합" },
  { code: "071", name: "우체국" },
  { code: "081", name: "하나은행" },
  { code: "088", name: "신한은행" },
  // 인터넷전문은행
  { code: "089", name: "케이뱅크" },
  { code: "090", name: "카카오뱅크" },
  { code: "092", name: "토스뱅크" },
  // 증권사
  { code: "209", name: "유안타증권" },
  { code: "218", name: "KB증권" },
  { code: "230", name: "미래에셋증권" },
  { code: "238", name: "대신증권" },
  { code: "240", name: "삼성증권" },
  { code: "243", name: "한국투자증권" },
  { code: "247", name: "NH투자증권" },
  { code: "261", name: "교보증권" },
  { code: "262", name: "하이투자증권" },
  { code: "263", name: "현대차증권" },
  { code: "264", name: "키움증권" },
  { code: "265", name: "이베스트투자증권" },
  { code: "266", name: "SK증권" },
  { code: "267", name: "대신증권(구)" },
  { code: "269", name: "한화투자증권" },
  { code: "270", name: "하나증권" },
  { code: "278", name: "신한투자증권" },
  { code: "279", name: "DB금융투자" },
  { code: "280", name: "유진투자증권" },
  { code: "287", name: "메리츠증권" },
  { code: "288", name: "카카오페이증권" },
  { code: "290", name: "부국증권" },
  { code: "291", name: "신영증권" },
  { code: "292", name: "케이프투자증권" },
  { code: "294", name: "한국포스증권" },
  { code: "295", name: "우리종합금융" },
  { code: "296", name: "토스증권" },
] as const;

/**
 * 한국 광역자치단체 17개. **다음(카카오) 우편번호 서비스가 주는 `sido` 값 그대로**다.
 * 주소는 검색으로만 채우므로, 정식 명칭("서울특별시")으로 두면 매핑이 필요해지고
 * 매핑이 어긋나는 순간 검증에서 거부된다. 한국 주소는 관행적으로도 약칭을 쓴다.
 */
export const KR_PROVINCES = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종특별자치시",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
] as const;
