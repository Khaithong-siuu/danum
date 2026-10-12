export type ReelKind = "video" | "photo";

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SECONDS = 90;
export const MIN_CLIP_SECONDS = 3;
export const MAX_CLIP_SECONDS = 30;
export const MAX_PREVIEW_SECONDS = 30; // Apple previews are 30 seconds long
export const CAPTION_MAX = 300;

export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 1200 -> "1.2K", 3400000 -> "3.4M" */
export function formatCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  }
  return String(n);
}

/** 75 -> "1:15" */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** True only for song previews hosted by Apple. */
export function isPreviewUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^https:\/\/[a-z0-9.-]+\.(itunes\.apple\.com|mzstatic\.com)\//i.test(value)
  );
}

/** True only for album artwork hosted by Apple. */
export function isArtworkUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^https:\/\/[a-z0-9.-]+\.mzstatic\.com\//i.test(value)
  );
}

/** Upload paths must look exactly like "<your-user-id>-reel-<timestamp>.<ext>". */
export function isOwnReelPath(path: unknown, userId: string): path is string {
  if (typeof path !== "string" || !UUID_REGEX.test(userId)) return false;
  return new RegExp(`^${userId}-reel-\\d{10,16}\\.[a-z0-9]{2,5}$`, "i").test(path);
}