// 스파이크 2: 유저 자신의 tweets(owned read)에서 특정 포스트의 리트윗 검출
// 사용법: USER_TOKEN=... USER_ID=<본인id> TARGET_POST_ID=<검증대상포스트> npx tsx spikes/spike-repost-check.ts
import { requireEnv } from './env';

const token = requireEnv('USER_TOKEN');
const userId = requireEnv('USER_ID');
const targetPostId = requireEnv('TARGET_POST_ID');

async function main() {
  const res = await fetch(
    `https://api.x.com/2/users/${userId}/tweets?max_results=100&tweet.fields=referenced_tweets`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  console.log('status:', res.status);
  console.log('rate-limit:', res.headers.get('x-rate-limit-remaining'), '/', res.headers.get('x-rate-limit-limit'));
  const json = (await res.json()) as {
    data?: { id: string; referenced_tweets?: { type: string; id: string }[] }[];
  };
  const found = json.data?.some((t) =>
    t.referenced_tweets?.some((r) => r.type === 'retweeted' && r.id === targetPostId),
  );
  console.log('리포스트 검출:', found ?? false);
  console.log('\n판정: Developer Console에서 이 호출이 owned read($0.001/리소스)로 차감됐는지 확인');
}
main();
