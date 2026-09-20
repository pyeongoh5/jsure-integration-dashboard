import Link from 'next/link';
import type { Metadata } from 'next';
import type { CampaignSeasonLp } from '@jsure/jwin-shared';
import { API_BASE } from '../../../lib/api';

async function fetchSeason(campaignSlug: string): Promise<CampaignSeasonLp | null> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignSlug}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as CampaignSeasonLp;
}

/** JST 기준 "2026/7/3(金) 12:00" */
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
  return `${part('year')}/${part('month')}/${part('day')}(${part('weekday')}) ${part('hour')}:${part('minute')}`;
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
  const images = season.keyVisualUrl ? [season.keyVisualUrl] : [];
  return {
    title: season.name,
    description,
    openGraph: { title: season.name, description, images, type: 'website' },
    twitter: {
      card: images.length > 0 ? 'summary_large_image' : 'summary',
      title: season.name,
      description,
      images,
    },
  };
}

/**
 * 시즌 LP (/c/{campaign}) — 키비주얼 아래 배경 위에 참여 브랜드 카드를 깐다.
 * 카드를 누르면 각 브랜드 응모 페이지로 간다. 이미지 2장(키비주얼·배경)은
 * 어드민 시즌 기본정보에서 올린다 — 없으면 해당 영역만 생략/단색으로 동작한다.
 */
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
    // 페이지 최소 높이 = 한 화면. 키비주얼이 위를 차지하면 배경 섹션(flex: 1)이
    // 나머지만 채워서, 콘텐츠가 짧아도 불필요한 스크롤이 생기지 않는다.
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {season.keyVisualUrl && (
        // 키비주얼·카드 이미지는 외부 URL(R2)이라 next/image 최적화 대상이 아니다
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={season.keyVisualUrl}
          alt={season.name}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      )}

      <section
        style={{
          flex: 1,
          padding: '32px 16px 48px',
          ...(season.listBackgroundUrl
            ? {
                backgroundImage: `url(${season.listBackgroundUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center top',
              }
            : { background: '#f7f5ef' }),
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {!season.keyVisualUrl && (
            <h1 style={{ textAlign: 'center', marginTop: 0 }}>{season.name}</h1>
          )}

          <p
            style={{
              width: 'fit-content',
              margin: '0 auto 24px',
              padding: '8px 20px',
              borderRadius: 999,
              background: 'rgba(255,255,255,.92)',
              boxShadow: '0 1px 4px rgba(0,0,0,.12)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {formatJst(season.startsAt)}〜{formatJst(season.endsAt)}
          </p>

          {season.brands.length === 0 && (
            <p style={{ textAlign: 'center', background: 'rgba(255,255,255,.9)', padding: 16, borderRadius: 12 }}>
              参加ブランドはまだありません。
            </p>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 16,
              padding: 16,
              borderRadius: 16,
              background: 'rgba(255,255,255,.85)',
            }}
          >
            {season.brands.map((brand) => (
              <Link
                key={brand.brandCampaignId}
                href={`/c/${season.slug}/${brand.brandSlug}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 10,
                  borderRadius: 12,
                  background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,.08)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                {brand.cardImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brand.cardImageUrl}
                    alt=""
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      borderRadius: 8,
                    }}
                  />
                )}
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {brand.brandLogoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brand.brandLogoUrl}
                      alt=""
                      width={28}
                      height={28}
                      style={{ borderRadius: '50%', objectFit: 'cover' }}
                    />
                  )}
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 13 }}>{brand.brandName}</strong>
                    {brand.xUsername && (
                      <span style={{ fontSize: 12, color: '#777' }}>@{brand.xUsername}</span>
                    )}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: '#555' }}>{brand.prizeSummary}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
