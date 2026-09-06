// 스파이크 7: 링크 카드 실측 (미디어 미첨부)
//
// 확인하려는 것
//  1) 미디어를 첨부하지 않은 트윗에 링크 카드(summary_large_image)가 뜨는가
//  2) 본문에 URL 이 두 개(규칙 링크 + LP)일 때 카드가 어느 URL 로 잡히는가
//  3) 카드 이미지를 눌렀을 때 LP 로 이동하는가
//
// 본문 조립은 스케줄러가 실제로 쓰는 buildPostText 를 그대로 재사용한다 —
// 여기서 통과한 모양이 곧 운영에서 나가는 모양이다.
//
// 사용법:
//   cd apps/jwin-api
//   BRAND_TOKEN=... LP_URL=https://.../c/demo RULES_URL=https://.../rules \
//     npx tsx spikes/spike-card-post.ts
//
// RULES_URL 을 빼면 LP 링크만으로 게시한다(카드 단독 확인용).
import { requireEnv } from './env';
import { buildPostText } from '../src/services/scheduler';

const token = requireEnv('BRAND_TOKEN');
const lpUrl = requireEnv('LP_URL');
const rulesUrl = process.env.RULES_URL ?? null;

const bodyText =
  process.env.BODY_TEXT ??
  `[J-WIN spike] 링크 카드 확인 ${new Date().toISOString()}\n応募はこちらから！`;

async function main() {
  const text = buildPostText({ bodyText, lpUrl, rulesUrl });
  console.log('--- 게시할 본문 ---');
  console.log(text);
  console.log('-------------------');

  const res = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const json = (await res.json()) as { data?: { id: string } };
  console.log('status:', res.status);
  console.log(JSON.stringify(json, null, 2));

  if (json.data?.id) {
    console.log(`\n게시물: https://x.com/i/status/${json.data.id}`);
  }
  console.log(
    [
      '',
      '판정 체크리스트',
      ' - 카드가 뜨는가 (이미지 아래 도메인 줄이 보이면 카드)',
      ' - 카드 도메인이 LP 인가, 규칙 페이지인가 → 본문 URL 순서 규칙 확정',
      ' - 카드 이미지를 눌렀을 때 LP 가 열리는가',
      ' - LP 에 cardImageUrl 을 넣지 않았다면 카드가 summary(작은 카드)로 뜬다',
      ' - 확인 후 테스트 포스트 삭제',
    ].join('\n'),
  );
}

void main();
