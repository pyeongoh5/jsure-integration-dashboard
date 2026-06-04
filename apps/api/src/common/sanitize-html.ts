import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "u",
  "s",
  "a",
  "img",
  "span",
  "div",
  "blockquote",
  "code",
  "pre",
  "hr",
];

const ALLOWED_STYLE_PROPERTIES = [
  "color",
  "background-color",
  "font-size",
  "font-family",
  "text-align",
];

const STYLE_VALUE_PATTERN = /^[#\w\s,.()%-]+$/;

export function sanitizeNoticeHtml(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      "*": ["style"],
    },
    allowedSchemes: ["http", "https"],
    allowedSchemesByTag: {
      img: ["http", "https", "r2"],
      a: ["http", "https", "mailto"],
    },
    allowedStyles: Object.fromEntries(
      ALLOWED_TAGS.map((tag) => [
        tag,
        Object.fromEntries(
          ALLOWED_STYLE_PROPERTIES.map((property) => [
            property,
            [STYLE_VALUE_PATTERN],
          ]),
        ),
      ]),
    ),
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
  });
}
