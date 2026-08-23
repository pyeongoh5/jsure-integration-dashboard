/** 브랜드 X 계정 연동 실패 화면 */
export default async function ConnectFailed({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const isDuplicate = reason === 'duplicate';
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24, textAlign: 'center' }}>
      <h2>連携に失敗しました</h2>
      {isDuplicate ? (
        <p>
          このXアカウントはすでに別のブランドアカウントと連携済みのため、このリンクでは連携できません。お手数ですが、担当者までお問い合わせください。
        </p>
      ) : (
        <p>お手数ですが、担当者から送付されたリンクを再度お試しください。</p>
      )}
    </main>
  );
}
