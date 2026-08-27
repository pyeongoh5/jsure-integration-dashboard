// 스파이크 1: connection_status로 팔로우 여부 1콜 판정이 가능한가
// 사용법: USER_TOKEN=... TARGET_USER_ID=<브랜드계정id> npx tsx spikes/spike-connection-status.ts
import { requireEnv } from './env';

const token = requireEnv('USER_TOKEN');
const target = requireEnv('TARGET_USER_ID');

async function main() {
  const res = await fetch(
    `https://api.x.com/2/users/${target}?user.fields=connection_status`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  console.log('status:', res.status);
  console.log('rate-limit:', res.headers.get('x-rate-limit-remaining'), '/', res.headers.get('x-rate-limit-limit'));
  console.log(JSON.stringify(await res.json(), null, 2));
  console.log('\n판정: data.connection_status에 "following" 포함 여부 확인');
}
main();
