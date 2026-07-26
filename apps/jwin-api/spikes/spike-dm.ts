// 스파이크 3: 브랜드 토큰으로 DM 발송 (종량제에서 dm.write 개방 여부 + $0.015 확인)
// 사용법: BRAND_TOKEN=... RECIPIENT_ID=<유저id> npx tsx spikes/spike-dm.ts
const token = process.env.BRAND_TOKEN!;
const recipient = process.env.RECIPIENT_ID!;

async function main() {
  const res = await fetch(`https://api.x.com/2/dm_conversations/with/${recipient}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '[J-WIN spike] DM 발송 테스트입니다.' }),
  });
  console.log('status:', res.status);
  console.log(JSON.stringify(await res.json(), null, 2));
}
main();
