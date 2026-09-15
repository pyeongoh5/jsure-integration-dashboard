// 본 코드의 서명 구현을 재사용한다 — 스파이크와 운영이 다른 서명을 쓰면 실측이 실측이 아니게 된다.
export { oauth1Header } from '../src/lib/ads-api';

export interface OAuth1Credentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}
