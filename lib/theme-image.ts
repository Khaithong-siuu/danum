import type { CSSProperties } from "react";

export type ImageAdjust = {
  x: number; // 0–100, horizontal focus
  y: number; // 0–100, vertical focus
  zoom: number; // 100–250 (percent)
  fade: number; // 0–100, how much the image blends into the background
};

export const DEFAULT_ADJUST: ImageAdjust = { x: 50, y: 50, zoom: 100, fade: 15 };

function toInt(value: unknown, fallback: number, min: number, max: number): number {
  const n =
    typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Clamps every value into its allowed range; anything unreadable uses the fallback. */
export function normalizeAdjust(
  raw: Partial<Record<keyof ImageAdjust, unknown>>,
  fallback: ImageAdjust = DEFAULT_ADJUST
): ImageAdjust {
  return {
    x: toInt(raw.x, fallback.x, 0, 100),
    y: toInt(raw.y, fallback.y, 0, 100),
    zoom: toInt(raw.zoom, fallback.zoom, 100, 250),
    fade: toInt(raw.fade, fallback.fade, 0, 100),
  };
}

/** Style for the cover <img>. Pair it with `object-cover` and a clipped parent. */
export function imageStyle(a: ImageAdjust): CSSProperties {
  return {
    objectPosition: `${a.x}% ${a.y}%`,
    transform: `scale(${a.zoom / 100})`,
    transformOrigin: `${a.x}% ${a.y}%`,
  };
}

/** Overlay that fades the image into the page background. */
export function fadeGradient(a: ImageAdjust): string {
  const topAlpha = ((a.fade / 100) * 0.8).toFixed(2);
  return `linear-gradient(to bottom, hsl(var(--background) / ${topAlpha}), hsl(var(--background)))`;
}