export type EmojiPart = { emoji: boolean; value: string };

// Quick check for "is there any emoji in this text at all?"
const HAS_EMOJI =
  /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|\p{Regional_Indicator}|\u20E3/u;

// Is this one character (grapheme) an emoji?
const IS_EMOJI =
  /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3/u;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** Splits text into plain text and emoji, keeping multi-part emoji together. */
export function splitEmoji(text: string): EmojiPart[] {
  if (!text) return [];
  if (!HAS_EMOJI.test(text)) return [{ emoji: false, value: text }];

  const graphemes = segmenter
    ? Array.from(segmenter.segment(text), (s) => s.segment)
    : Array.from(text);

  const parts: EmojiPart[] = [];
  let buffer = "";

  for (const g of graphemes) {
    if (IS_EMOJI.test(g)) {
      if (buffer) {
        parts.push({ emoji: false, value: buffer });
        buffer = "";
      }
      parts.push({ emoji: true, value: g });
    } else {
      buffer += g;
    }
  }

  if (buffer) parts.push({ emoji: false, value: buffer });
  return parts;
}

function emojiCode(glyph: string, keepVariationSelector: boolean): string {
  return Array.from(glyph)
    .map((ch) => ch.codePointAt(0) as number)
    .filter((cp) => keepVariationSelector || cp !== 0xfe0f)
    .map((cp) => cp.toString(16))
    .join("-");
}

const BASES = [
  "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/",
  "https://unpkg.com/emoji-datasource-apple@15.1.2/img/apple/64/",
  "https://fastly.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/",
];

/** Where to try loading the picture for one emoji, in order. */
export function emojiSources(glyph: string): string[] {
  const stripped = emojiCode(glyph, false);
  const full = emojiCode(glyph, true);
  // Full with FE0F first (many Apple emojis have -fe0f), then stripped without FE0F
  const codes = full === stripped ? [full] : [full, stripped];

  return BASES.flatMap((base) => codes.map((code) => `${base}${code}.png`));
}