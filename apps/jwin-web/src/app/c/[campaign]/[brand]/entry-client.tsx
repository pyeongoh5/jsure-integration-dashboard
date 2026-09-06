'use client';

import { useEffect, useState } from 'react';
import type { CampaignLp, EntryResultResponse } from '@jsure/jwin-shared';
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

  useEffect(() => {
    api<{ loggedIn: boolean }>('/me')
      .then((me) => setPhase(me.loggedIn ? { name: 'ready' } : { name: 'need_login' }))
      .catch(() => setPhase({ name: 'error', message: '通信エラーが発生しました。' }));
  }, []);

  async function enter() {
    setPhase({ name: 'drawing' });
    try {
      const data = await api<EntryResultResponse>(`/brand-campaigns/${campaign.brandCampaignId}/enter`, {
        method: 'POST',
      });
      setPhase({ name: 'result', data });
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 409) setPhase({ name: 'already' });
      else if (status === 401) setPhase({ name: 'need_login' });
      else setPhase({ name: 'error', message: '応募できませんでした。時間をおいて再度お試しください。' });
    }
  }

  /** 검증 재시도 — 응모 당일에만 유효 (F-5.3) */
  async function retryVerify(winnerId: string, prizeName: string) {
    setRetrying(true);
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
    } finally {
      setRetrying(false);
    }
  }

  const button = (label: string, onClick: () => void, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 18,
        padding: '14px 40px',
        borderRadius: 999,
        border: 'none',
        background: disabled ? '#ccc' : '#e0245e',
        color: '#fff',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  );

  switch (phase.name) {
    case 'loading':
      return <p>読み込み中…</p>;
    case 'need_login':
      return (
        <>
          <h2>Xでログインして応募</h2>
          <p>応募にはXアカウントの連携が必要です。</p>
          {button('Xでログイン', () => {
            window.location.href = userLoginUrl(`/c/${campaign.campaign.slug}/${campaign.brandSlug}`);
          })}
        </>
      );
    case 'ready':
      return (
        <>
          <h2>フォロー&リポストして抽選に参加！</h2>
          <ol style={{ textAlign: 'left' }}>
            <li>ブランドのXアカウントをフォロー</li>
            <li>本日のキャンペーンポストをリポスト</li>
            <li>下のボタンで抽選！</li>
          </ol>
          {button('抽選に参加する', enter)}
        </>
      );
    case 'drawing':
      return <p style={{ fontSize: 24 }}>抽選中…</p>;
    case 'already':
      return <p>本日はすでに応募済みです。また明日のポストからご応募ください！</p>;
    case 'error':
      return <p>{phase.message}</p>;
    case 'result': {
      const result = phase.data;
      if (result.result === 'lose') {
        return (
          <>
            <h2>残念…はずれ</h2>
            <ResultMedia url={campaign.loseMediaUrl} alt="はずれ" />
            <p>明日のポストから再チャレンジできます！</p>
            <PrLink url={campaign.prUrl} />
          </>
        );
      }
      if (result.result === 'win_pending') {
        return (
          <>
            <h2>🎉 当選候補です！</h2>
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
            )}
          </>
        );
      }
      return (
        <>
          <h2>🎉 当選おめでとうございます！</h2>
          <ResultMedia url={campaign.winMediaUrl} alt="当選" />
          <p>{result.prizeName}</p>
          {result.needsShipping ? (
            <a href={`/winners/${result.winnerId}/shipping`}>配送先を入力する →</a>
          ) : (
            <p>ギフトコードはブランド公式アカウントからDMでお送りします。</p>
          )}
          <PrLink url={campaign.prUrl} />
        </>
      );
    }
  }
}
