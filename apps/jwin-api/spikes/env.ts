// 스파이크 스크립트용 환경변수 로더.
// apps/jwin-api/.env를 자동으로 읽으므로 --env-file 없이 실행해도 된다.
// 이미 셸에 설정된 값이 .env보다 우선한다(인라인 오버라이드 가능).
import { existsSync } from "fs";
import { resolve } from "path";

const envFile = resolve(import.meta.dirname, "../.env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`환경변수 ${name} 가 없습니다. 실행 예시는 spikes/README.md 를 보세요.`);
    process.exit(1);
  }
  return value;
}
