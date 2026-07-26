import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'J-WIN キャンペーン',
  description: 'フォロー&リポストでその場で当たる！',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#faf7f2' }}>
        {children}
      </body>
    </html>
  );
}
