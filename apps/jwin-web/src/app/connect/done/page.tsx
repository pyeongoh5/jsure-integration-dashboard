/** 브랜드 X 계정 연동 완료 화면 */
export default async function ConnectDone({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const { account } = await searchParams;
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24, textAlign: 'center' }}>
      <h2>連携が完了しました</h2>
      <p>{account ? `@${account} の連携が完了しました。` : 'Xアカウントの連携が完了しました。'}</p>
      <p>このページを閉じていただいて構いません。</p>
    </main>
  );
}
