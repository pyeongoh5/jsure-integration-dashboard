/** reason별 안내 문구 (§10: 중첩 삼항 대신 Record 상수로 분기) */
const MESSAGE_BY_REASON: Record<string, string> = {
  duplicate:
    'このXアカウントはすでに別のブランドアカウントと連携済みのため、このリンクでは連携できません。お手数ですが、担当者までお問い合わせください。',
  mismatch:
    'このリンクはすでに別のXアカウントと連携済みのため、現在ログイン中のアカウントでは連携できません。お手数ですが、担当者までお問い合わせください。',
};
const DEFAULT_MESSAGE = 'お手数ですが、担当者から送付されたリンクを再度お試しください。';

/** 브랜드 X 계정 연동 실패 화면 */
export default async function ConnectFailed({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = (reason && MESSAGE_BY_REASON[reason]) ?? DEFAULT_MESSAGE;
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24, textAlign: 'center' }}>
      <h2>連携に失敗しました</h2>
      <p>{message}</p>
    </main>
  );
}
