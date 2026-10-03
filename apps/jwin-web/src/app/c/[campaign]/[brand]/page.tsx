import Link from 'next/link';
import type { Metadata } from 'next';
import type { CampaignLp } from '@jsure/jwin-shared';
import { API_BASE } from '../../../../lib/api';
import EntryClient from './entry-client';
import WinHistory from './win-history';

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

/** JST "2026.9.1(火)" */
function jstDay(iso: string): string {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}.${part('month')}.${part('day')}(${part('weekday')})`;
}

/**
 * X 링크 카드(summary_large_image)용 메타데이터.
 * 트윗 본문의 이 페이지 URL 로 카드가 만들어지고, 카드 이미지를 누르면 이 페이지가 열린다 —
 * 첨부 이미지는 뷰어만 열리므로 "이미지 클릭 → LP 이동" 은 이 경로로만 가능하다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ campaign: string; brand: string }>;
}): Promise<Metadata> {
  const { campaign: campaignSlug, brand: brandSlug } = await params;
  const campaign = await fetchBrandCampaign(campaignSlug, brandSlug);
  if (!campaign) return { title: 'キャンペーンが見つかりません' };

  const title = `${campaign.brandName} キャンペーン`;
  const description = campaign.prizeSummary || 'フォロー&リポストでその場で当たる！';
  // og:image 는 포스트 소재의 첫 번째 이미지를 그대로 쓴다 — 별도 업로드 불필요
  const images = campaign.postImageUrl ? [campaign.postImageUrl] : [];

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

/**
 * 캠페인 응모 LP — 포스터(소재 이미지)가 디자인을 전담하고 페이지는 침묵한다.
 * 포스터 전폭 → 기간 바 → CTA(응모) → 회색 안내 박스 → 당첨 히스토리 → 시즌 배너.
 */
export default async function BrandCampaignLpPage({
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
    <div style={{ background: '#f6f6f4', minHeight: '100dvh' }}>
      <main
        style={{
          maxWidth: 640,
          margin: '0 auto',
          background: '#fff',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 포스터 — 경품·기간·카피는 이미지가 말한다 */}
        {campaign.postImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={campaign.postImageUrl}
            alt={`${campaign.brandName} キャンペーン`}
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        ) : (
          <header style={{ padding: '40px 24px 8px', textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>{campaign.brandName}</h1>
          </header>
        )}

        {/* 기간 바 — 포스터 바로 아래 한 줄 */}
        <p
          style={{
            margin: 0,
            padding: '10px 16px',
            background: '#1a1a1a',
            color: '#e8d9a0',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '.04em',
          }}
        >
          【 キャンペーン期間 】 {jstDay(campaign.startsAt)} − {jstDay(campaign.endsAt)}
        </p>

        <section style={{ padding: '32px 24px 8px', textAlign: 'center' }}>
          {/* 브랜드 한 줄 — 포스터가 못 담는 공식 계정 링크만 남긴다 */}
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#777' }}>
            {campaign.brandName}
            {campaign.xUsername && (
              <>
                {' '}
                <a
                  href={`https://x.com/${campaign.xUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#555' }}
                >
                  @{campaign.xUsername}
                </a>
              </>
            )}
          </p>

          <EntryClient campaign={campaign} />

          {campaign.todayPostUrl && (
            <p style={{ marginTop: 16 }}>
              <a
                href={campaign.todayPostUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 13, color: '#555' }}
              >
                本日のキャンペーンポストはこちら →
              </a>
            </p>
          )}
        </section>

        {/* 안내 — 레퍼런스처럼 회색 박스로 조용히 */}
        <section style={{ padding: '24px 24px 0' }}>
          <div
            style={{
              background: '#f3f3f1',
              border: '1px solid #e5e5e2',
              borderRadius: 8,
              padding: '14px 16px',
              fontSize: 12,
              lineHeight: 1.8,
              color: '#666',
              textAlign: 'left',
            }}
          >
            ・ブランドの公式Xアカウントのフォローと、本日のキャンペーンポストのリポストが当選条件です
            <br />
            ・本人確認のためX（Twitter）の認証を利用しています
            <br />
            ・利用する情報は、SNSの「ID」「アカウント名」「投稿の確認」「フォローしているアカウントの確認」のみです
          </div>
        </section>

        <div style={{ padding: '0 24px' }}>
          <WinHistory
            brandCampaignId={campaign.brandCampaignId}
            campaignEnded={new Date(campaign.endsAt).getTime() < Date.now()}
          />
        </div>

        {/* 하단 배너 — 둘 다 16:9 로 크롭해 비율을 맞추고, 응모 페이지를 떠나지
            않도록 새 탭으로 연다 */}
        <div style={{ padding: '32px 24px 0', display: 'grid', gap: 16 }}>
          {/* ① 시즌 배너 — 썸네일이 곧 배너 (시즌 LP 로 이동) */}
          {campaign.campaign.thumbnailUrl && (
            <Link
              href={`/c/${campaign.campaign.slug}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'block' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={campaign.campaign.thumbnailUrl}
                alt={`${campaign.campaign.name} — 他の参加ブランドもチェック`}
                style={{
                  display: 'block',
                  width: '100%',
                  aspectRatio: '16 / 9',
                  objectFit: 'cover',
                  borderRadius: 12,
                }}
              />
            </Link>
          )}

          {/* ② 브랜드 배너 — 클릭하면 브랜드 사이트(PR URL) */}
          {campaign.prBannerUrl && campaign.prUrl && (
            <a href={campaign.prUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={campaign.prBannerUrl}
                alt={`${campaign.brandName} 公式サイト`}
                style={{
                  display: 'block',
                  width: '100%',
                  aspectRatio: '16 / 9',
                  objectFit: 'cover',
                  borderRadius: 12,
                }}
              />
            </a>
          )}
        </div>

        <footer
          style={{
            marginTop: 'auto',
            padding: '32px 24px 24px',
            textAlign: 'center',
            fontSize: 11,
            color: '#999',
          }}
        >
          © {new Date().getFullYear()} {campaign.brandName}. All Rights Reserved.
        </footer>
      </main>
    </div>
  );
}
