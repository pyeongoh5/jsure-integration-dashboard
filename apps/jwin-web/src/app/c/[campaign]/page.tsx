import Link from 'next/link';
import type { Metadata } from 'next';
import type { CampaignSeasonLp } from '@jsure/jwin-shared';
import { API_BASE } from '../../../lib/api';

async function fetchSeason(campaignSlug: string): Promise<CampaignSeasonLp | null> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignSlug}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as CampaignSeasonLp;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ campaign: string }>;
}): Promise<Metadata> {
  const { campaign: campaignSlug } = await params;
  const season = await fetchSeason(campaignSlug);
  if (!season) return { title: 'キャンペーンが見つかりません' };

  const description = `参加ブランド ${season.brands.length}社／フォロー&リポストでその場で当たる！`;
  return {
    title: season.name,
    description,
    openGraph: { title: season.name, description, type: 'website' },
    twitter: { card: 'summary', title: season.name, description },
  };
}

/** 시즌 LP (/c/{campaign}) — 참여 브랜드 카드에서 각 브랜드 응모 페이지로 보낸다 */
export default async function CampaignSeasonPage({
  params,
}: {
  params: Promise<{ campaign: string }>;
}) {
  const { campaign: campaignSlug } = await params;
  const season = await fetchSeason(campaignSlug);
  if (!season) {
    return <main style={{ padding: 24 }}>キャンペーンが見つかりません。</main>;
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1>{season.name}</h1>
      <p style={{ fontSize: 14, color: '#555' }}>
        期間: {new Date(season.startsAt).toLocaleDateString('ja-JP')} 〜{' '}
        {new Date(season.endsAt).toLocaleDateString('ja-JP')}
      </p>

      {season.brands.length === 0 && <p>参加ブランドはまだありません。</p>}

      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        {season.brands.map((brand) => (
          <Link
            key={brand.brandCampaignId}
            href={`/c/${season.slug}/${brand.brandSlug}`}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              padding: 20,
              borderRadius: 12,
              background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,.08)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            {brand.brandLogoUrl && (
              // 브랜드 로고는 외부 URL(R2) 이라 next/image 최적화 대상이 아니다
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.brandLogoUrl}
                alt=""
                width={48}
                height={48}
                style={{ borderRadius: 8, objectFit: 'cover' }}
              />
            )}
            <span>
              <strong>{brand.brandName}</strong>
              {brand.xUsername && <span> @{brand.xUsername}</span>}
              <span
                style={{ display: 'block', marginTop: 8, fontSize: 14, color: '#555' }}
              >
                {brand.prizeSummary}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
