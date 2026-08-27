// 스파이크 1: connection_status로 팔로우 여부 1콜 판정이 가능한가
// 사용법: 실행 예시는 spikes/README.md 참고 (.env 자동 로드)
import { requireEnv } from "./env";

const token = requireEnv("USER_TOKEN");
const target = requireEnv("TARGET_USER_ID");

async function xGet(path: string) {
  const res = await fetch(`https://api.x.com/2/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, remaining: res.headers.get("x-rate-limit-remaining"), body: await res.json() };
}

async function main() {
  // 토큰 주인과 대상이 같으면 X가 connection_status를 생략한다 — 오판 방지
  const me = await xGet("users/me");
  console.log("토큰 주인:", me.body?.data?.username, `(${me.body?.data?.id})`);
  if (me.body?.data?.id === target) {
    console.log("\n❌ 토큰 주인과 TARGET_USER_ID가 같습니다. 참여자 계정 토큰으로 브랜드 계정을 조회해야 합니다.");
    process.exit(1);
  }

  const res = await xGet(`users/${target}?user.fields=connection_status`);
  console.log("status:", res.status, "| rate-limit 남음:", res.remaining);
  console.log(JSON.stringify(res.body, null, 2));

  const status: string[] | undefined = res.body?.data?.connection_status;
  if (status?.includes("following")) {
    console.log("\n✅ 통과 — connection_status로 1콜 판정 가능:", status.join(", "));
    return;
  }
  if (status) {
    console.log("\n△ connection_status는 오지만 following 없음:", status.join(", "));
    console.log("   대상 계정을 팔로우한 상태인지 확인하고 재실행.");
    return;
  }
  console.log("\n❌ connection_status 필드가 없음.");
  console.log("   팔로우 관계가 전혀 없으면 X가 필드를 생략하므로, 먼저 대상 계정을 팔로우하고 재실행할 것.");
  console.log("   팔로우한 상태에서도 안 오면 스코프(follows.read) 누락이거나 종량제 플랜 미지원 → 대안 검토 필요.");
}

main();
