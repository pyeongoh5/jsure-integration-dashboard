import type { Metadata } from 'next';
import type { CampaignLp } from '@jsure/jwin-shared';
import { API_BASE } from '../../../lib/api';
import EntryClient from './entry-client';
import WinHistory from './win-history';

async function fetchCampaign(slug: string): Promise<CampaignLp | null> {
  const res = await fetch(`${API_BASE}/campaigns/${slug}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as CampaignLp;
}

/**
 * X 링크 카드(summary_large_image)용 메타데이터.
 * 트윗 본문의 이 페이지 URL 로 카드가 만들어지고, 카드 이미지를 누르면 이 페이지가 열린다 —
 * 첨부 이미지는 뷰어만 열리므로 "이미지 클릭 → LP 이동" 은 이 경로로만 가능하다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await fetchCampaign(slug);
  if (!campaign) return { title: 'キャンペーンが見つかりません' };

  const title = `${campaign.brandName} キャンペーン`;
  const description = campaign.prizeSummary || 'フォロー&リポストでその場で当たる！';
  const images = campaign.cardImageUrl ? [campaign.cardImageUrl] : [];

  return {
    title,
    description,
    openGraph: { title, description, images, type: 'website' },
    twitter: {
      // 이미지가 없으면 큰 카드가 비어 보이므로 요약 카드로 떨어뜨린다.
      card: images.length > 0 ? 'summary_large_image' : 'summary',
      title,
      description,
      images,
    },
  };
}

/** 캠페인 단독 LP (/c/{slug}) — 응모 + 당첨 히스토리 (F-3) */
export default async function CampaignLpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const campaign = await fetchCampaign(slug);
  if (!campaign) {
    return <main style={{ padding: 24 }}>キャンペーンが見つかりません。</main>;
  }

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
