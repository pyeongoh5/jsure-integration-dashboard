import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedRow = {
  triggerKey:
    | "SNS_APPLICATION_APPLIED"
    | "SNS_APPLICATION_APPROVED"
    | "SNS_APPLICATION_REJECTED"
    | "SNS_APPLICATION_SHIPPED"
    | "SNS_APPLICATION_DELIVERED"
    | "SNS_APPLICATION_RECEIPT_CONFIRMED"
    | "SNS_POST_SUBMITTED"
    | "SNS_POST_DEADLINE_REMINDER"
    | "SNS_POST_APPROVED"
    | "SNS_POST_REJECTED"
    | "SNS_POST_REJECTION_REMINDER"
    | "SNS_INSIGHT_SUBMITTED"
    | "SNS_INSIGHT_APPROVED"
    | "SNS_INSIGHT_REMINDER"
    | "SNS_SETTLEMENT_COMPLETED"
    | "SNS_CAMPAIGN_COMPLETED";
  enabled: boolean;
  body: string;
};

type FakePurchaseTriggerKey =
  | "FAKE_PURCHASE_APPLICATION_APPLIED"
  | "FAKE_PURCHASE_APPLICATION_APPROVED"
  | "FAKE_PURCHASE_APPLICATION_REJECTED"
  | "FAKE_PURCHASE_ORDER_SUBMITTED"
  | "FAKE_PURCHASE_REVIEW_SUBMITTED"
  | "FAKE_PURCHASE_REVIEW_APPROVED"
  | "FAKE_PURCHASE_REVIEW_REJECTED"
  | "FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER"
  | "FAKE_PURCHASE_SETTLEMENT_COMPLETED"
  | "FAKE_PURCHASE_CAMPAIGN_COMPLETED";

type SimpleReviewTriggerKey =
  | "SIMPLE_REVIEW_APPLICATION_APPLIED"
  | "SIMPLE_REVIEW_APPLICATION_APPROVED"
  | "SIMPLE_REVIEW_APPLICATION_REJECTED"
  | "SIMPLE_REVIEW_APPLICATION_SHIPPED"
  | "SIMPLE_REVIEW_APPLICATION_DELIVERED"
  | "SIMPLE_REVIEW_APPLICATION_RECEIPT_CONFIRMED"
  | "SIMPLE_REVIEW_SUBMITTED"
  | "SIMPLE_REVIEW_APPROVED"
  | "SIMPLE_REVIEW_REJECTED"
  | "SIMPLE_REVIEW_DEADLINE_REMINDER"
  | "SIMPLE_REVIEW_REJECTION_REMINDER"
  | "SIMPLE_REVIEW_SETTLEMENT_COMPLETED"
  | "SIMPLE_REVIEW_CAMPAIGN_COMPLETED";

type SeedRowSimpleReview = {
  triggerKey: SimpleReviewTriggerKey;
  enabled: boolean;
  body: string;
};

type SeedRowFakePurchase = {
  triggerKey: FakePurchaseTriggerKey;
  enabled: boolean;
  body: string;
};

const APPLIED = `✨【お知らせ】キャンペーン受付 ✨

ご応募ありがとうございます！
「{{campaignTitle}}」への受付が正常に完了いたしました。

💌 当選発表について

🔹 発表: 応募後1週間前後
🔹 方法: 当選者様へ個別にご連絡

※大変恐縮ですが、ご当選とならなかった方へのご連絡は省略させていただきます。ご了承ください。

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複で届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00`;

const APPROVED = `🎉【当選おめでとうございます！】キャンペーンのご案内 🎉

お世話になっております。
「{{campaignTitle}}」の当選者に選出されました！👏✨

ご応募誠にありがとうございました。現在、心を込めて商品の発送準備を進めております。📦
発送が完了いたしましたら、改めてご案内メッセージをお送りいたします。

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営:平日 10:00〜20:00`;

const SHIPPED = `📦【発送完了】キャンペーン商品発送のお知らせ 📦

お世話になっております！
お待ちかねの「{{campaignTitle}}」のキャンペーン商品が、本日無事に発送されました！🎉

配送状況は下記の情報よりご確認いただけます。

🚚 配送情報のご案内
- 配送業者:{{trackingCarrier}}
- 追跡番号:{{trackingNumber}}

💡 お届け期間および追跡に関するご案内
- 日本国内から発送の場合:発送後、約2日でお届け
- 韓国から発送の場合:発送後、約7日でお届け
※韓国からの発送の場合、通関等の事情により、システムへの追跡情報の反映に遅れが生じる場合がございます。何卒ご理解いただけますようお願いいたします。

✨ お願い:商品が到着いたしましたら、必ず【応募履歴 - 受取確認】ボタンを押してください！

それでは、商品の到着まで今しばらくお待ちください。よろしくお願いいたします！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営:平日 10:00〜20:00`;

const DELIVERED = `🎁【配達完了】商品は無事に届きましたでしょうか？ 🎁
お世話になっております！
ご応募いただいた「{{campaignTitle}}」のキャンペーン商品が、無事に配達完了となりました。

商品がお手元に届きましたら、下記の内容を必ずご確認いただけますようお願いいたします。

✨ 必須チェックリスト
1️⃣ 受取確認: 商品が到着いたしましたら、必ず【応募履歴 - 受取確認】ボタンを押してください！
2️⃣ レビュー投稿: 事前にご案内したガイドラインに沿って、素敵なご投稿をお願いいたします。📸
3️⃣ URL提出: 投稿完了後、必ず【応募履歴 - 投稿URL提出】をお願いいたします。

⚠️ 万が一、商品に問題がある場合
配送中の破損や商品に不具合などがございましたら、ご投稿前にこのメッセージへお気軽にご連絡ください。迅速に対応させていただきます。

商品がお気に召していただけますと幸いです。素敵なご投稿を心より楽しみにしております。よろしくお願いいたします！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営:平日 10:00〜20:00`;

const POST_REJECTED = `⚠️【要確認】キャンペーン投稿 修正・再提出のお願い ⚠️

お世話になっております。
「{{campaignTitle}}」の投稿URLをご提出いただき、誠にありがとうございます。

ご提出いただいたコンテンツを運営事務局にて確認いたしましたところ、誠に恐縮ではございますが、一部修正および補完が必要な箇所が見つかり、再審査処理とさせていただきました。

大変お手数ですが、下記の修正理由をご確認いただき、ご対応いただけますようお願いいたします。🙏

📝 修正ご依頼内容
- 修正の理由: {{rejectReason}}
- 再提出期限: {{resubmitDeadline}} までに修正の上、URLの再提出をお願いいたします。

※ガイドラインに沿って投稿を修正いただいた後、必ずURLの再提出をお願いいたします。再提出が完了した時点で、最終検収へと進みます。

お手数をおかけして大変申し訳ございませんが、ご協力のほどよろしくお願いいたします。

※自動送信のため返信不要ですが、ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00`;

const POST_REJECTION_REMINDER = `🚨【再送】キャンペーン投稿修正のお願い 🚨

お世話になっております。
「{{campaignTitle}}」の修正ご依頼につきまして、まだ再提出が確認できていないため再度ご連絡いたしました。

🔹 修正の理由: {{rejectReason}}
🔹 最終期限: {{finalDeadline}} まで(期限厳守)

※ 期限内に修正およびURLの再提出が確認できない場合、報酬の支給制限やペナルティが科される場合がございます。必ずご確認の上、ご対応をお願いいたします。

※自動送信のため返信不要ですが、ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00`;

const POST_DEADLINE_REMINDER = `⏰【期限間近】キャンペーン投稿期限まであと{{remainingDays}}日です！ ⏰
お世話になっております！
ご参加いただいている「{{campaignTitle}}」の投稿期限まで、あと{{remainingDays}}日となりました。

投稿期限に遅れのないよう、ご注意ください。

✨ 投稿完了後のお願い
SNSへご投稿いただいた後は、必ずシステムより【応募履歴 - 投稿URL提出】を完了していただけますようお願いいたします。

素敵なご投稿を心より楽しみにしております。よろしくお願いいたします！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00`;

const INSIGHT_REMINDER = `📊【インサイト提出のお願い】数値の登録をお願いいたします 📊
お世話になっております。
ご参加いただいている「{{campaignTitle}}」の投稿から7日が経過いたしました。素敵なご投稿をいただき、誠にありがとうございます。

キャンペーンの最終精算および成果測定のため、大変お手数ですが下記のご案内をお読みいただき、インサイト資料のご提出をお願いいたします。

📝 提出項目のご案内
- 対象インサイト: いいね数・コメント数・シェア数・リポスト数・保存数・閲覧数・リーチ数などの画面スクリーンショットおよび数値入力

※投稿の成果数値が確認できる画面をスクリーンショットし、サイト内の【応募履歴 - インサイト提出】よりご登録をお願いいたします。期限内にご提出いただくことで、報酬の精算手続きがスムーズに進行いたします。

ご協力のほどよろしくお願いいたします。

※自動送信のため返信不要ですが、ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00`;

const SETTLEMENT_COMPLETED = `💰【お振込完了】キャンペーン報酬支給のお知らせ 💰
お世話になっております！
ご参加いただいた「{{campaignTitle}}」のレポート確認が完了し、キャンペーン報酬のお振込手続きが完了いたしました。🎉

お振込情報は下記をご確認ください。
💳 お振込情報のご案内
- 振込名義: 株）ジェイシュア
- お振込金額: {{rewardJpy}} 円

💡 ご確認のお願い
- 複数のキャンペーンに同時にご参加いただいた場合、個別ではなく合算された金額で一括してお振込いたします。
- 本通知メッセージはシステム上、キャンペーンの案件ごとにそれぞれ自動送信されます。実際の口座には合算金額で入金されますので、あらかじめご了承いただけますようお願いいたします。

この度は、弊社のキャンペーンのために素敵なご投稿をいただき誠にありがとうございました。またのご参加を心よりお待ちしております！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営:平日 10:00〜20:00`;

const FP_APPLIED = `✨【応募受付】買取レビュー キャンペーン ✨

「{{campaignTitle}}」へのご応募ありがとうございます！
下記の内容で受付が完了いたしました。

📦 プラットフォーム: {{subType}}
💰 商品価格: {{productPriceJpy}} 円
🔗 商品ページ: {{productUrl}}
💴 予定精算金額: {{totalSettlementJpy}} 円

💌 選考について
🔹 発表: 応募後1週間前後
🔹 方法: 当選者様へ個別にご連絡

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
🕐 運営：平日 10:00〜20:00`;

const FP_APPROVED = `🎉【当選】買取レビュー キャンペーンのご案内 🎉

「{{campaignTitle}}」の当選者に選出されました！

📦 プラットフォーム: {{subType}}
💰 商品価格: {{productPriceJpy}} 円 (立替後、精算にて全額返金)
🔗 商品ページ: {{productUrl}}
💴 予定精算金額: {{totalSettlementJpy}} 円

✨ お願い
1️⃣ 商品ページよりご自身でご購入ください
2️⃣ 注文番号と注文明細のスクリーンショットを【応募履歴 - 注文情報提出】よりご登録ください

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
🕐 運営：平日 10:00〜20:00`;

const FP_REVIEW_REJECTED = `⚠️【要確認】レビュー修正・再提出のお願い ⚠️

「{{campaignTitle}}」({{subType}}) のレビューをご提出いただき、誠にありがとうございます。
運営事務局にて確認いたしましたところ、下記の修正をお願いすることとなりました。

📝 修正のご依頼
- 修正の理由: {{rejectReason}}
- 提出されたレビュー: {{reviewUrl}}

ガイドラインに沿ってレビューを修正いただき、URLとスクリーンショットの再提出をお願いいたします。

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
🕐 運営：平日 10:00〜20:00`;

const FP_REVIEW_REMINDER = `⏰【期限間近】レビュー提出期限まであと{{remainingDays}}日 ⏰

「{{campaignTitle}}」({{subType}}) のレビュー提出期限まで、あと{{remainingDays}}日 ({{reviewDeadline}} まで) となりました。

期限までにレビューの投稿およびシステムへの提出をお願いいたします。

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
🕐 運営：平日 10:00〜20:00`;

const FP_SETTLEMENT = `💰【お振込完了】買取レビュー キャンペーン精算のお知らせ 💰

「{{campaignTitle}}」({{subType}}) の精算が完了いたしました。

💳 お振込情報
- お振込金額: {{totalSettlementJpy}} 円 (報酬 + 商品価格返金)

複数キャンペーン同時参加の場合、合算して一括でお振込いたします。

ご参加誠にありがとうございました。またのご参加をお待ちしております！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
🕐 運営：平日 10:00〜20:00`;

const SEED_ROWS: SeedRow[] = [
  { triggerKey: "SNS_APPLICATION_APPLIED", enabled: true, body: APPLIED },
  { triggerKey: "SNS_APPLICATION_APPROVED", enabled: true, body: APPROVED },
  { triggerKey: "SNS_APPLICATION_REJECTED", enabled: false, body: "" },
  { triggerKey: "SNS_APPLICATION_SHIPPED", enabled: true, body: SHIPPED },
  { triggerKey: "SNS_APPLICATION_DELIVERED", enabled: true, body: DELIVERED },
  { triggerKey: "SNS_APPLICATION_RECEIPT_CONFIRMED", enabled: false, body: "" },
  { triggerKey: "SNS_POST_SUBMITTED", enabled: false, body: "" },
  { triggerKey: "SNS_POST_DEADLINE_REMINDER", enabled: true, body: POST_DEADLINE_REMINDER },
  { triggerKey: "SNS_POST_APPROVED", enabled: false, body: "" },
  { triggerKey: "SNS_POST_REJECTED", enabled: true, body: POST_REJECTED },
  { triggerKey: "SNS_POST_REJECTION_REMINDER", enabled: true, body: POST_REJECTION_REMINDER },
  { triggerKey: "SNS_INSIGHT_SUBMITTED", enabled: false, body: "" },
  { triggerKey: "SNS_INSIGHT_APPROVED", enabled: false, body: "" },
  { triggerKey: "SNS_INSIGHT_REMINDER", enabled: true, body: INSIGHT_REMINDER },
  { triggerKey: "SNS_SETTLEMENT_COMPLETED", enabled: true, body: SETTLEMENT_COMPLETED },
  { triggerKey: "SNS_CAMPAIGN_COMPLETED", enabled: false, body: "" },
];

const FP_SEED_ROWS: SeedRowFakePurchase[] = [
  { triggerKey: "FAKE_PURCHASE_APPLICATION_APPLIED", enabled: true, body: FP_APPLIED },
  { triggerKey: "FAKE_PURCHASE_APPLICATION_APPROVED", enabled: true, body: FP_APPROVED },
  { triggerKey: "FAKE_PURCHASE_APPLICATION_REJECTED", enabled: false, body: "" },
  { triggerKey: "FAKE_PURCHASE_ORDER_SUBMITTED", enabled: false, body: "" },
  { triggerKey: "FAKE_PURCHASE_REVIEW_SUBMITTED", enabled: false, body: "" },
  { triggerKey: "FAKE_PURCHASE_REVIEW_APPROVED", enabled: false, body: "" },
  { triggerKey: "FAKE_PURCHASE_REVIEW_REJECTED", enabled: true, body: FP_REVIEW_REJECTED },
  { triggerKey: "FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER", enabled: true, body: FP_REVIEW_REMINDER },
  { triggerKey: "FAKE_PURCHASE_SETTLEMENT_COMPLETED", enabled: true, body: FP_SETTLEMENT },
  { triggerKey: "FAKE_PURCHASE_CAMPAIGN_COMPLETED", enabled: false, body: "" },
];

const SR_SEED_ROWS: SeedRowSimpleReview[] = [
  { triggerKey: "SIMPLE_REVIEW_APPLICATION_APPLIED", enabled: false, body: "" },
  { triggerKey: "SIMPLE_REVIEW_APPLICATION_APPROVED", enabled: false, body: "" },
  { triggerKey: "SIMPLE_REVIEW_APPLICATION_REJECTED", enabled: false, body: "" },
  { triggerKey: "SIMPLE_REVIEW_APPLICATION_SHIPPED", enabled: false, body: "" },
  { triggerKey: "SIMPLE_REVIEW_APPLICATION_DELIVERED", enabled: false, body: "" },
  { triggerKey: "SIMPLE_REVIEW_APPLICATION_RECEIPT_CONFIRMED", enabled: false, body: "" },
  { triggerKey: "SIMPLE_REVIEW_SUBMITTED", enabled: false, body: "" },
  { triggerKey: "SIMPLE_REVIEW_APPROVED", enabled: false, body: "" },
  { triggerKey: "SIMPLE_REVIEW_REJECTED", enabled: false, body: "" },
  { triggerKey: "SIMPLE_REVIEW_DEADLINE_REMINDER", enabled: false, body: "" },
  { triggerKey: "SIMPLE_REVIEW_REJECTION_REMINDER", enabled: false, body: "" },
  { triggerKey: "SIMPLE_REVIEW_SETTLEMENT_COMPLETED", enabled: false, body: "" },
  { triggerKey: "SIMPLE_REVIEW_CAMPAIGN_COMPLETED", enabled: false, body: "" },
];

async function main(): Promise<void> {
  for (const row of SEED_ROWS) {
    await prisma.lineMessageTemplate.upsert({
      where: {
        category_triggerKey: {
          category: "SNS",
          triggerKey: row.triggerKey,
        },
      },
      create: {
        category: "SNS",
        triggerKey: row.triggerKey,
        enabled: row.enabled,
        body: row.body,
      },
      update: {},
    });
  }
  for (const row of FP_SEED_ROWS) {
    await prisma.lineMessageTemplate.upsert({
      where: {
        category_triggerKey: {
          category: "FAKE_PURCHASE",
          triggerKey: row.triggerKey,
        },
      },
      create: {
        category: "FAKE_PURCHASE",
        triggerKey: row.triggerKey,
        enabled: row.enabled,
        body: row.body,
      },
      update: {},
    });
  }
  for (const row of SR_SEED_ROWS) {
    await prisma.lineMessageTemplate.upsert({
      where: {
        category_triggerKey: {
          category: "SIMPLE_REVIEW",
          triggerKey: row.triggerKey,
        },
      },
      create: {
        category: "SIMPLE_REVIEW",
        triggerKey: row.triggerKey,
        enabled: row.enabled,
        body: row.body,
      },
      update: {},
    });
  }
  const count = await prisma.lineMessageTemplate.count();
  console.log(`Seed complete. Total templates: ${count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
