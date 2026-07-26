// 스파이크 4: URL 포함 포스트 게시 ($0.20/건 확인)
// 사용법: BRAND_TOKEN=... npx tsx spikes/spike-post.ts
const token = process.env.BRAND_TOKEN!;

async function main() {
  const res = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `[J-WIN spike] 게시 테스트 ${new Date().toISOString()}\nhttps://example.com/campaign`,
    }),
  });
  console.log('status:', res.status);
  console.log(JSON.stringify(await res.json(), null, 2));
  console.log('\n판정: Developer Console 차감액이 $0.20인지 확인 후 테스트 포스트 삭제');
}
main();
