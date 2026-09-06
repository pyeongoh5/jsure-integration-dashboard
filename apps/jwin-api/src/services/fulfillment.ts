import { getPrisma } from '@jsure/jwin-db';
import { decrypt, encrypt } from '../lib/crypto';
import { getBrandAccessToken } from '../lib/tokens';
import { sendDm } from '../lib/x-api';

/**
 * 이행(Fulfillment)
 * - CODE: 재고에서 코드 1개를 원자적으로 할당 → 브랜드 계정 DM으로 발송 (D-4 확정)
 *   DM 문구는 캠페인별 dmTemplate 렌더링 (F-6.1)
 * - PHYSICAL: 유저가 배송지 입력(암호화 저장, 캠페인 종료 시점까지) → 어드민이 수동 발송 처리
 */

const DEFAULT_DM_TEMPLATE = [
  '【{{BRAND_NAME}}】ご当選おめでとうございます！',
  '賞品: {{PRIZE_NAME}}',
  'ギフトコード: {{CODE}}',
  '※このDMは自動送信です。',
].join('\n');

/** dmTemplate 플레이스홀더 치환: {{CODE}} {{PRIZE_NAME}} {{USERNAME}} {{BRAND_NAME}} */
export function renderDmText(
  template: string | null,
  values: { code: string; prizeName: string; username: string; brandName: string },
): string {
  const source = template && template.trim().length > 0 ? template : DEFAULT_DM_TEMPLATE;
  return source
    .replaceAll('{{CODE}}', values.code)
    .replaceAll('{{PRIZE_NAME}}', values.prizeName)
    .replaceAll('{{USERNAME}}', values.username)
    .replaceAll('{{BRAND_NAME}}', values.brandName);
}

export async function assignCodeAndSendDm(winnerId: string): Promise<void> {
  const prisma = getPrisma();
  const winner = await prisma.winner.findUnique({
    where: { id: winnerId },
    include: {
      prize: true,
      code: true,
      entry: { include: { user: true, campaign: { include: { brandAccount: true } } } },
      // brandAccount.label 이 브랜드 표시명이다 (DM 의 {{BRAND_NAME}})
    },
  });
  if (!winner || winner.verification !== 'PASSED' || winner.prize.type !== 'CODE') return;
  if (winner.fulfillment === 'DM_SENT') return;

  // 코드 할당 (이미 할당돼 있으면 재사용 — DM 재시도 케이스)
  let code = winner.code;
  if (!code) {
    // 원자적 할당: AVAILABLE 코드 1개를 조건부로 점유
    const candidate = await prisma.prizeCode.findFirst({
      where: { prizeId: winner.prizeId, status: 'AVAILABLE' },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) {
      await prisma.winner.update({
        where: { id: winnerId },
        data: { fulfillment: 'FAILED', dmError: 'no code stock' },
      });
      return;
    }
    const claimed = await prisma.prizeCode.updateMany({
      where: { id: candidate.id, status: 'AVAILABLE' },
      data: { status: 'ASSIGNED', winnerId },
    });
    if (claimed.count === 0) return assignCodeAndSendDm(winnerId); // 경합 → 재시도
    code = await prisma.prizeCode.findUniqueOrThrow({ where: { id: candidate.id } });
  }

  const campaign = winner.entry.campaign;
  const brandAccount = campaign.brandAccount;
  if (!brandAccount || !brandAccount.encryptedAccessToken) {
    await prisma.winner.update({
      where: { id: winnerId },
      data: { fulfillment: 'FAILED', dmError: 'brand not connected' },
    });
    return;
  }

  try {
    const token = await getBrandAccessToken(brandAccount);
    const text = renderDmText(campaign.dmTemplate, {
      code: decrypt(code.encryptedCode),
      prizeName: winner.prize.name,
      username: winner.entry.user.xUsername,
      brandName: brandAccount.label,
    });
    await sendDm(token, winner.entry.user.xUserId, text);
    await prisma.$transaction([
      prisma.winner.update({
        where: { id: winnerId },
        data: { fulfillment: 'DM_SENT', dmSentAt: new Date(), dmError: null },
      }),
      prisma.prizeCode.update({ where: { id: code.id }, data: { status: 'SENT' } }),
    ]);
  } catch (error) {
    await prisma.winner.update({
      where: { id: winnerId },
      data: { fulfillment: 'FAILED', dmError: error instanceof Error ? error.message : 'dm failed' },
    });
  }
}

export interface ShippingInfo {
  postalCode: string;
  prefecture: string;
  address1: string;
  address2?: string;
  fullName: string;
  phone: string;
}

export type SaveShippingResult = 'saved' | 'closed' | 'not_eligible';

/**
 * 현물 당첨자 배송지 저장.
 * 캠페인 종료 시점(endsAt) 이후에는 입력 불가 (F-6.3) — 'closed' 반환.
 */
export async function saveShipping(
  winnerId: string,
  userId: string,
  info: ShippingInfo,
): Promise<SaveShippingResult> {
  const prisma = getPrisma();
  const winner = await prisma.winner.findFirst({
    where: { id: winnerId, entry: { userId }, verification: 'PASSED' },
    include: { prize: true, entry: { include: { campaign: { include: { campaign: true } } } } },
  });
  if (!winner || winner.prize.type !== 'PHYSICAL') return 'not_eligible';
  // 마감은 시즌 종료 시각 기준 (F-6.3)
  if (winner.entry.campaign.campaign.endsAt.getTime() < Date.now()) return 'closed';
  await prisma.winner.update({
    where: { id: winnerId },
    data: {
      encryptedShipping: encrypt(JSON.stringify(info)),
      shippingEnteredAt: new Date(),
      fulfillment: 'READY',
    },
  });
  return 'saved';
}
