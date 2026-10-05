'use client';

import { useEffect, useState } from 'react';
import type { CampaignLp, EntryResultResponse, TodayEntryResponse } from '@jsure/jwin-shared';
import { api, userLoginUrl } from '../../../../lib/api';

type Phase =
  | { name: 'loading' }
  | { name: 'need_login' }
  | { name: 'ready' }
  | { name: 'drawing' }
  | { name: 'result'; data: EntryResultResponse }
  | { name: 'already' }
  | { name: 'error'; message: string };

/** 결과 미디어 (당첨/낙첨 이미지 — F-4) */
function ResultMedia({ url, alt }: { url: string | null; alt: string }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} style={{ maxWidth: '100%', borderRadius: 12, margin: '12px 0' }} />;
}

/** PR 전환 버튼 (F-4.3) */
function PrLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <p>
      <a href={url} target="_blank" rel="noreferrer">
        ブランドサイトはこちら →
      </a>
    </p>
  );
}

export default function EntryClient({ campaign }: { campaign: CampaignLp }) {
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [retrying, setRetrying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    // 로그인 확인 후 오늘 응모 상태를 복구한다 — 새로고침·재진입해도
    // 당첨 후보(검증 대기)면 재검증 화면으로 돌아온다
    api<{ loggedIn: boolean }>('/me')
      .then(async (me) => {
        if (!me.loggedIn) {
          setPhase({ name: 'need_login' });
          return;
        }
        try {
          const today = await api<TodayEntryResponse>(
            `/brand-campaigns/${campaign.brandCampaignId}/entries/today`,
          );
          setPhase(today.entered ? { name: 'result', data: today } : { name: 'ready' });
        } catch {
          // 상태 복구 실패는 치명적이지 않다 — 응모 화면으로 두면 409 가 다시 안내한다
          setPhase({ name: 'ready' });
        }
      })
      .catch(() => setPhase({ name: 'error', message: '通信エラーが発生しました。' }));
  }, [campaign.brandCampaignId]);

  async function enter() {
    setPhase({ name: 'drawing' });
    try {
      const data = await api<EntryResultResponse>(`/brand-campaigns/${campaign.brandCampaignId}/enter`, {
        method: 'POST',
      });
      setPhase({ name: 'result', data });
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 409) {
        // 이미 응모한 날 — 당첨 후보면 "응모 완료" 대신 검증 화면을 복구한다
        try {
          const today = await api<TodayEntryResponse>(
            `/brand-campaigns/${campaign.brandCampaignId}/entries/today`,
          );
          setPhase(today.entered ? { name: 'result', data: today } : { name: 'already' });
        } catch {
          setPhase({ name: 'already' });
        }
      }
      else if (status === 401) setPhase({ name: 'need_login' });
      else if (status === 404)
        // 오늘자 포스트가 아직 없다 — 게시 전 응모 (no_post_today)
        setPhase({
          name: 'error',
          message: `本日のキャンペーンポストはまだ投稿されていません。毎日${campaign.dailyPostTime}（日本時間）頃に投稿されます。投稿後にご応募ください。`,
        });
      else setPhase({ name: 'error', message: '応募できませんでした。時間をおいて再度お試しください。' });
    }
  }

  /** 검증 재시도 — 응모 당일에만 유효 (F-5.3) */
  async function retryVerify(winnerId: string, prizeName: string) {
    setRetrying(true);
    setVerifyError(null);
    try {
      const res = await api<{ ok: boolean; prizeType?: 'PHYSICAL' | 'CODE'; reason?: string }>(
        `/winners/${winnerId}/verify`,
        { method: 'POST' },
      );
      if (res.ok && res.prizeType) {
        setPhase({
          name: 'result',
          data: {
            result: 'win_confirmed',
            winnerId,
            prizeName,
            prizeType: res.prizeType,
            needsShipping: res.prizeType === 'PHYSICAL',
          },
        });
      } else {
        setPhase({
          name: 'result',
          data: {
            result: 'win_pending',
            winnerId,
            prizeName,
            failReason: res.reason === 'follow' || res.reason === 'repost' ? res.reason : undefined,
          },
        });
      }
    } catch {
      // 확인 실패가 화면 전체를 죽이면 안 된다 — 당첨 후보 상태를 유지하고 재시도를 열어둔다
      setVerifyError('確認に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setRetrying(false);
    }
  }

  /* X 로고 — 외부 에셋 없이 인라인 SVG */
  const xLogo = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );

  const button = (label: string, onClick: () => void, disabled = false, withLogo = true) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        minWidth: 260,
        fontSize: 16,
        fontWeight: 700,
        padding: '16px 40px',
        borderRadius: 999,
        border: 'none',
        background: disabled ? '#9ca3af' : '#0f1419',
        color: '#fff',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {withLogo && xLogo}
      {label}
    </button>
  );

  /* 상태(당첨/낙첨/후보) 카드 — 포스터 아래에서 조용히 결과만 말한다 */
  const card = (children: React.ReactNode) => (
    <div
      style={{
        background: '#fff',
        border: '1px solid #eceae6',
        borderRadius: 16,
        boxShadow: '0 2px 10px rgba(0,0,0,.06)',
        padding: '28px 20px',
      }}
    >
      {children}
    </div>
  );

  switch (phase.name) {
    case 'loading':
      return <p style={{ color: '#999' }}>読み込み中…</p>;
    case 'need_login':
      return (
        <>
          <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
            応募にはXアカウントの連携が必要です。
          </p>
          {button('Xでログインして応募', () => {
            window.location.href = userLoginUrl(`/c/${campaign.campaign.slug}/${campaign.brandSlug}`);
          })}
        </>
      );
    case 'ready': {
      // 시즌 종료 후에는 응모 입구를 닫는다
      if (new Date(campaign.endsAt).getTime() < Date.now()) {
        return <p>このキャンペーンは終了しました。たくさんのご参加ありがとうございました！</p>;
      }
      // 오늘자 포스트가 아직 없으면(게시 시각 전) 버튼 대신 예정 시각을 안내한다 —
      // 응모는 당일 포스트에 귀속되므로(D-1) 게시 전에는 눌러도 404 만 난다
      if (!campaign.todayPostUrl) {
        return (
          <>
            <h2>本日の応募はもうすぐ！</h2>
            <p>
              本日のキャンペーンポストは {campaign.dailyPostTime}
              （日本時間）頃に投稿予定です。投稿後にこのページからご応募いただけます。
            </p>
          </>
        );
      }
      return (
        <>
          <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
            フォロー&リポストで、その場で結果がわかります。
          </p>
          {button('抽選に参加する', enter)}
          <p style={{ marginTop: 10, fontSize: 12, color: '#999' }}>
            ※ フォローと本日のポストのリポストが当選条件です
          </p>
        </>
      );
    }
    case 'drawing':
      return card(<p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>抽選中…</p>);
    case 'already':
      return card(<p style={{ margin: 0 }}>本日はすでに応募済みです。また明日のポストからご応募ください！</p>);
    case 'error':
      return card(<p style={{ margin: 0 }}>{phase.message}</p>);
    case 'result': {
      const result = phase.data;
      if (result.result === 'lose') {
        return card(
          <>
            <h2 style={{ marginTop: 0 }}>残念…はずれ</h2>
            <ResultMedia url={campaign.loseMediaUrl} alt="はずれ" />
            <p>明日のポストから再チャレンジできます！</p>
            <PrLink url={campaign.prUrl} />
          </>,
        );
      }
      if (result.result === 'win_pending') {
        return card(
          <>
            <h2 style={{ marginTop: 0 }}>🎉 当選候補です！</h2>
            <p>
              {result.failReason === 'follow' && 'フォローが確認できませんでした。'}
              {result.failReason === 'repost' && '本日のポストのリポストが確認できませんでした。'}
              {!result.failReason && '当選確定にはフォローとリポストの確認が必要です。'}
            </p>
            <p style={{ fontSize: 13, color: '#777' }}>本日中（日本時間）にご対応ください。</p>
            {button(
              retrying ? '確認中…' : 'フォロー&リポストしたので確認する',
              () => retryVerify(result.winnerId, result.prizeName),
              retrying,
              false,
            )}
            {verifyError && <p style={{ color: '#dc2626', fontSize: 14 }}>{verifyError}</p>}
          </>,
        );
      }
      return card(
        <>
          <h2 style={{ marginTop: 0 }}>🎉 当選おめでとうございます！</h2>
          <ResultMedia url={campaign.winMediaUrl} alt="当選" />
          <p style={{ fontWeight: 700 }}>{result.prizeName}</p>
          {result.needsShipping ? (
            <a
              href={`/winners/${result.winnerId}/shipping`}
              style={{
                display: 'inline-block',
                padding: '12px 32px',
                borderRadius: 999,
                background: '#0f1419',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              配送先を入力する →
            </a>
          ) : (
            <p>ギフトコードはブランド公式アカウントからDMでお送りします。</p>
          )}
          <PrLink url={campaign.prUrl} />
        </>,
      );
    }
  }
}
