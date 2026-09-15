import type { Metadata } from 'next';
import type { CampaignLp } from '@jsure/jwin-shared';
import { API_BASE } from '../../../../../lib/api';

async function fetchBrandCampaign(
  campaignSlug: string,
  brandSlug: string,
): Promise<CampaignLp | null> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignSlug}/brands/${brandSlug}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as CampaignLp;
}

/** JST 기준 "2026年9月1日(火) 11:00" 형식 */
function formatJst(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}年${part('month')}月${part('day')}日(${part('weekday')}) ${part('hour')}:${part('minute')}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ campaign: string; brand: string }>;
}): Promise<Metadata> {
  const { campaign: campaignSlug, brand: brandSlug } = await params;
  const campaign = await fetchBrandCampaign(campaignSlug, brandSlug);
  if (!campaign) return { title: 'キャンペーンが見つかりません' };
  return { title: `${campaign.brandName} フォロー&リポストキャンペーン応募規約` };
}

/**
 * 응모 규약 페이지 — 캐러셀 카드 2번째 슬라이드의 목적지.
 * 브랜드명·기간·경품·계정 핸들을 캠페인 데이터로 치환해 렌더하는 템플릿이다.
 * (참고 구조: https://sonboda.neo-atatter.com/rules)
 */
export default async function RulesPage({
  params,
}: {
  params: Promise<{ campaign: string; brand: string }>;
}) {
  const { campaign: campaignSlug, brand: brandSlug } = await params;
  const campaign = await fetchBrandCampaign(campaignSlug, brandSlug);
  if (!campaign) {
    return <main style={{ padding: 24 }}>キャンペーンが見つかりません。</main>;
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24, lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 20 }}>
        {campaign.brandName} フォロー&リポストキャンペーン応募規約
      </h1>

      <p>
        本キャンペーンにご応募いただく前に、以下の規約をご確認ください。ご応募いただいた場合、本規約に同意いただいたものとみなします。
      </p>

      <h2 style={{ fontSize: 16 }}>【応募期間】</h2>
      <p>
        {formatJst(campaign.startsAt)} 〜 {formatJst(campaign.endsAt)}
      </p>

      <h2 style={{ fontSize: 16 }}>【キャンペーン概要】</h2>
      <p>
        期間中、対象ポストをリポストすると、その場で抽選結果をご確認いただけます。1日1回、期間中何度でもご応募いただけます。
      </p>

      <h2 style={{ fontSize: 16 }}>【賞品】</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {campaign.prizes.map((prize) => (
          <li key={`${prize.name}-${prize.totalQty}`}>
            ・{prize.name}：{prize.totalQty}名様
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: 16 }}>【応募方法】</h2>
      <ol>
        <li>
          公式Xアカウント{' '}
          {campaign.xUsername ? (
            <a href={`https://x.com/${campaign.xUsername}`} target="_blank" rel="noreferrer">
              @{campaign.xUsername}
            </a>
          ) : (
            '（公式アカウント）'
          )}{' '}
          をフォロー
        </li>
        <li>期間中、毎日投稿されるキャンペーンポストをリポスト</li>
        <li>画像をクリックし、X連携認証を許可</li>
        <li>移動先のページで当選結果を確認</li>
      </ol>
    </main>
  );
}
