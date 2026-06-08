/**
 * tiptap 가 생성하는 HTML 을 LINE Flex Message bubble JSON 으로 변환.
 *
 * 지원 블록: <p>, <h2>, <h3>, <ul>/<ol> + <li>, <blockquote>, <img> (1장 hero).
 * 인라인 마크업(<strong>, <em>, <a> 등)은 텍스트로 평탄화 (LINE text 컴포넌트
 * 하나는 단일 스타일만 지원하므로 모두 풀어서 plain text 화).
 *
 * 첫 번째 <img src="https://...">  만 hero 로 사용. 추가 이미지는 무시.
 */

export type FlexBubble = {
  type: "bubble";
  hero?: {
    type: "image";
    url: string;
    size: "full";
    aspectMode: "cover";
    aspectRatio: string;
  };
  body: {
    type: "box";
    layout: "vertical";
    spacing: "md";
    contents: FlexComponent[];
  };
};

type FlexComponent =
  | {
      type: "text";
      text: string;
      wrap: true;
      size?: "sm" | "md" | "lg" | "xl";
      weight?: "bold" | "regular";
      color?: string;
      margin?: "sm" | "md";
    }
  | { type: "separator"; margin?: "md" };

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function plainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  ).trim();
}

function extractFirstImageUrl(html: string): string | null {
  // src="..." 안에 https URL 만 사용. (r2: 같은 비공식 스킴은 발송 전에 resolve 되어 있어야 함)
  const match = /<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"/i.exec(html);
  return match ? match[1] ?? null : null;
}

function liItems(blockHtml: string): string[] {
  const items: string[] = [];
  const re = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(blockHtml)) !== null) {
    const text = plainText(m[1] ?? "");
    if (text) items.push(text);
  }
  return items;
}

/** 본문 텍스트 컴포넌트만 추출 (최대 길이 보호). */
function buildBodyContents(html: string): FlexComponent[] {
  const contents: FlexComponent[] = [];
  const blockRe =
    /<(p|h2|h3|ul|ol|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const tag = (m[1] ?? "").toLowerCase();
    const inner = m[2] ?? "";
    if (tag === "p") {
      const text = plainText(inner);
      if (text) contents.push({ type: "text", text, wrap: true, size: "sm" });
    } else if (tag === "h2") {
      const text = plainText(inner);
      if (text)
        contents.push({
          type: "text",
          text,
          wrap: true,
          size: "lg",
          weight: "bold",
          margin: "md",
        });
    } else if (tag === "h3") {
      const text = plainText(inner);
      if (text)
        contents.push({
          type: "text",
          text,
          wrap: true,
          size: "md",
          weight: "bold",
          margin: "md",
        });
    } else if (tag === "ul") {
      liItems(inner).forEach((item) =>
        contents.push({ type: "text", text: `• ${item}`, wrap: true, size: "sm" }),
      );
    } else if (tag === "ol") {
      liItems(inner).forEach((item, idx) =>
        contents.push({
          type: "text",
          text: `${idx + 1}. ${item}`,
          wrap: true,
          size: "sm",
        }),
      );
    } else if (tag === "blockquote") {
      const text = plainText(inner);
      if (text)
        contents.push({
          type: "text",
          text,
          wrap: true,
          size: "sm",
          color: "#6b7280",
          margin: "md",
        });
    }
  }
  // 각 텍스트 컴포넌트의 길이 제한 (LINE: 최대 2000 chars/text)
  return contents.map((c) =>
    c.type === "text" && c.text.length > 1800
      ? { ...c, text: c.text.slice(0, 1797) + "..." }
      : c,
  );
}

export function htmlToFlexBubble(html: string, heroImageUrl?: string | null): FlexBubble {
  const body = buildBodyContents(html);
  const heroUrl =
    heroImageUrl && heroImageUrl.startsWith("https://")
      ? heroImageUrl
      : extractFirstImageUrl(html);

  const bubble: FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents:
        body.length > 0
          ? body
          : [{ type: "text", text: " ", wrap: true, size: "sm" }],
    },
  };
  if (heroUrl) {
    bubble.hero = {
      type: "image",
      url: heroUrl,
      size: "full",
      aspectMode: "cover",
      aspectRatio: "16:9",
    };
  }
  return bubble;
}

/** 알림센터/푸시 알림에 표시될 미리보기 텍스트 (Flex 의 altText). */
export function htmlToAltText(html: string, fallback = "新しいお知らせ"): string {
  const text = plainText(html.replace(/<img\b[^>]*>/gi, ""));
  return (text || fallback).slice(0, 200);
}
