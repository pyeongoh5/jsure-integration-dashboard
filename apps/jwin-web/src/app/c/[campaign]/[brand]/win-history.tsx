'use client';

import { useEffect, useState } from 'react';
import type { WinHistoryItem } from '@jsure/jwin-shared';
import { api } from '../../../../lib/api';

/**
 * 당첨 히스토리 (F-3.6): 확정 당첨 건만 표시. 낙첨/미확정 로그는 표시하지 않는다.
 * PHYSICAL 미입력 건은 배송지 입력으로 유도 (캠페인 종료 전까지 — F-6.3).
 */
export default function WinHistory({
  brandCampaignId,
  campaignEnded,
}: {
  brandCampaignId: string;
  campaignEnded: boolean;
}) {
  const [wins, setWins] = useState<WinHistoryItem[] | null>(null);

  useEffect(() => {
    api<WinHistoryItem[]>(`/me/wins?brandCampaignId=${brandCampaignId}`)
      .then(setWins)
      .catch(() => setWins(null)); // 미로그인 등 → 표시 생략
  }, [brandCampaignId]);

  if (!wins || wins.length === 0) return null;

  return (
    <section style={{ marginTop: 40, textAlign: 'left' }}>
      <h3>当選履歴</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {wins.map((win) => (
          <li
            key={win.winnerId}
            style={{
              padding: 12,
              marginBottom: 8,
              borderRadius: 8,
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,.08)',
            }}
          >
            <strong>{win.prizeName}</strong>
            <span style={{ marginLeft: 8, fontSize: 13, color: '#777' }}>{win.dateJst}</span>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              {win.prizeType === 'CODE' &&
                (win.dmSent ? 'ギフトコードをDMでお送りしました' : 'DM送信の準備中です')}
              {win.prizeType === 'PHYSICAL' && win.shippingEntered && '配送先入力済み'}
              {win.prizeType === 'PHYSICAL' && !win.shippingEntered && win.needsShipping && (
                <a href={`/winners/${win.winnerId}/shipping`}>配送先を入力する →</a>
              )}
              {win.prizeType === 'PHYSICAL' &&
                !win.shippingEntered &&
                !win.needsShipping &&
                campaignEnded &&
                'キャンペーン終了のため配送先の入力は締め切りました'}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
