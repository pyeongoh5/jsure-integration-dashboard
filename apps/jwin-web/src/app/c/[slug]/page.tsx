import type { CampaignLp } from '@jsure/jwin-shared';
import { API_BASE } from '../../../lib/api';
import EntryClient from './entry-client';
import WinHistory from './win-history';

/** 캠페인 단독 LP (/c/{slug}) — 응모 + 당첨 히스토리 (F-3) */
export default async function CampaignLpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await fetch(`${API_BASE}/campaigns/${slug}`, { cache: 'no-store' });
  if (!res.ok) {
    return <main style={{ padding: 24 }}>キャンペーンが見つかりません。</main>;
  }
  const campaign = (await res.json()) as CampaignLp;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24, textAlign: 'center' }}>
      <h1>{campaign.brandName}</h1>
      {campaign.xUsername && (
        <p>
          <a href={`https://x.com/${campaign.xUsername}`} target="_blank" rel="noreferrer">
            @{campaign.xUsername}
          </a>
        </p>
      )}
      <p>
        期間: 〜{new Date(campaign.endsAt).toLocaleDateString('ja-JP')} ／ 毎日応募OK！
        フォロー&リポストでその場で当たる！
      </p>
      <p style={{ fontSize: 14, color: '#555' }}>{campaign.prizeSummary}</p>
      {campaign.todayPostUrl && (
        <p>
          <a href={campaign.todayPostUrl} target="_blank" rel="noreferrer">
            本日のキャンペーンポストはこちら →
          </a>
        </p>
      )}
      <EntryClient campaign={campaign} />
      <WinHistory campaignId={campaign.campaignId} campaignEnded={new Date(campaign.endsAt).getTime() < Date.now()} />
    </main>
  );
}
