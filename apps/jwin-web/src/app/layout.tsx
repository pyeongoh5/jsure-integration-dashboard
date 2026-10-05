import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'J-WIN キャンペーン',
  description: 'フォロー&リポストでその場で当たる！',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // translate="no": 크롬 번역이 텍스트 노드를 <font> 로 감싸 DOM 을 바꾸면
    // React 가 unmount 시 removeChild 로 죽는다(배송지 수정에서 실측).
    // 참여자 대상 언어는 일본어 고정이므로 기계 번역을 차단한다.
    <html lang="ja" translate="no">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#faf7f2' }}>
        {children}
      </body>
    </html>
  );
}
