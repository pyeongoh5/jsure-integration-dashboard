import Link from 'next/link';
import type { CampaignSummary } from '@jsure/jwin-shared';
import { API_BASE } from '../../lib/api';

/** 진행 중 시즌 캠페인 목록 페이지 — 카드를 누르면 시즌 LP 로 간다 */
export default async function CampaignListPage() {
  const res = await fetch(`${API_BASE}/campaigns`, { cache: 'no-store' });
  const campaigns: CampaignSummary[] = res.ok ? await res.json() : [];

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1>開催中のキャンペーン</h1>
      {campaigns.length === 0 && <p>現在開催中のキャンペーンはありません。</p>}
      <div style={{ display: 'grid', gap: 16 }}>
        {campaigns.map((campaign) => (
          <Link
            key={campaign.slug}
            href={`/c/${campaign.slug}`}
            style={{
              display: 'block',
              padding: 20,
              borderRadius: 12,
              background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,.08)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <strong>{campaign.name}</strong>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#555' }}>
              参加ブランド {campaign.brandCount}社
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>
              {new Date(campaign.startsAt).toLocaleDateString('ja-JP')} 〜{' '}
              {new Date(campaign.endsAt).toLocaleDateString('ja-JP')}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
