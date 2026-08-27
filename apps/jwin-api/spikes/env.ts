// 스파이크 스크립트용 필수 환경변수 읽기.
// 값이 없으면 'Bearer undefined'로 401을 맞는 대신 즉시 원인을 알려준다.
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`환경변수 ${name} 가 없습니다. 실행 예시는 spikes/README.md 를 보세요.`);
    process.exit(1);
  }
  return value;
}
