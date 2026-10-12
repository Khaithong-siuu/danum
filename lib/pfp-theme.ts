const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_REGEX.test(value);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const hsl = (h: number, s: number, l: number) =>
  `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;

/**
 * Builds scoped CSS variables from one hex color.
 * Only numbers derived from a validated hex are ever written into the CSS.
 * `selector` is a trusted, hard-coded class such as ".pfp-theme".
 */
export function buildThemeCss(hex: string, selector: string): string {
  if (!isHexColor(hex)) return "";

  const { h, s } = hexToHsl(hex);

  const tint = clamp(s, 12, 45); // soft backgrounds
  const vivid = clamp(s, 50, 90); // links and accents

  // Yellow-green hues need a darker accent to stay readable on light backgrounds
  const warm = h >= 45 && h <= 170;
  const lightBrand = warm ? 30 : 42;

  const light = [
    `--background: ${hsl(h, tint, 96)}`,
    `--foreground: ${hsl(h, 30, 12)}`,
    `--card: ${hsl(h, tint, 99)}`,
    `--card-foreground: ${hsl(h, 30, 12)}`,
    `--muted: ${hsl(h, tint, 92)}`,
    `--muted-foreground: ${hsl(h, 15, 38)}`,
    `--border: ${hsl(h, tint * 0.7, 86)}`,
    `--brand: ${hsl(h, vivid, lightBrand)}`,
  ].join("; ");

  const dark = [
    `--background: ${hsl(h, tint * 0.8, 8)}`,
    `--foreground: ${hsl(h, 20, 96)}`,
    `--card: ${hsl(h, tint * 0.8, 11)}`,
    `--card-foreground: ${hsl(h, 20, 96)}`,
    `--muted: ${hsl(h, tint * 0.7, 16)}`,
    `--muted-foreground: ${hsl(h, 12, 66)}`,
    `--border: ${hsl(h, tint * 0.6, 20)}`,
    `--brand: ${hsl(h, vivid, 64)}`,
  ].join("; ");

  return `${selector} { ${light}; } .dark ${selector} { ${dark}; }`;
}