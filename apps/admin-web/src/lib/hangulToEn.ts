const JAMO_TO_EN: Record<string, string> = {
  ㅂ: "q", ㅈ: "w", ㄷ: "e", ㄱ: "r", ㅅ: "t",
  ㅛ: "y", ㅕ: "u", ㅑ: "i", ㅐ: "o", ㅔ: "p",
  ㅁ: "a", ㄴ: "s", ㅇ: "d", ㄹ: "f", ㅎ: "g",
  ㅗ: "h", ㅓ: "j", ㅏ: "k", ㅣ: "l",
  ㅋ: "z", ㅌ: "x", ㅊ: "c", ㅍ: "v", ㅠ: "b",
  ㅜ: "n", ㅡ: "m",
  ㅃ: "Q", ㅉ: "W", ㄸ: "E", ㄲ: "R", ㅆ: "T",
  ㅒ: "O", ㅖ: "P",
  ㄳ: "rt", ㄵ: "sw", ㄶ: "sg", ㄺ: "fr", ㄻ: "fa",
  ㄼ: "fq", ㄽ: "ft", ㄾ: "fx", ㄿ: "fv", ㅀ: "fg",
  ㅄ: "qt",
  ㅘ: "hk", ㅙ: "ho", ㅚ: "hl", ㅝ: "nj", ㅞ: "np",
  ㅟ: "nl", ㅢ: "ml",
};

const INITIALS = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const MEDIALS = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const FINALS = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

function jamoToEn(jamo: string): string {
  return JAMO_TO_EN[jamo] ?? jamo;
}

export function hangulToEn(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xac00 && code <= 0xd7a3) {
      const idx = code - 0xac00;
      const initial = INITIALS[Math.floor(idx / (21 * 28))] ?? "";
      const medial = MEDIALS[Math.floor((idx % (21 * 28)) / 28)] ?? "";
      const final = FINALS[idx % 28] ?? "";
      out += jamoToEn(initial) + jamoToEn(medial) + (final ? jamoToEn(final) : "");
    } else if (JAMO_TO_EN[ch]) {
      out += JAMO_TO_EN[ch];
    } else {
      out += ch;
    }
  }
  return out;
}
