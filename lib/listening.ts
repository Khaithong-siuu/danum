import { isArtworkUrl, isPreviewUrl } from "@/lib/reels";

export type ListeningSession = {
  trackId: number;
  title: string;
  artist: string;
  previewUrl: string;
  artworkUrl: string | null;
  isPlaying: boolean;
  positionMs: number;
  updatedAt: string;
};

export type ListeningRow = {
  track_id: number;
  title: string;
  artist: string;
  preview_url: string;
  artwork_url: string | null;
  is_playing: boolean;
  position_ms: number;
  updated_at: string;
};

/** Turns a database row into a session, refusing any audio that isn't Apple's. */
export function rowToSession(
  row: ListeningRow | null | undefined
): ListeningSession | null {
  if (!row || !isPreviewUrl(row.preview_url)) return null;

  return {
    trackId: Number(row.track_id),
    title: String(row.title ?? "").slice(0, 200),
    artist: String(row.artist ?? "").slice(0, 200),
    previewUrl: row.preview_url,
    artworkUrl: isArtworkUrl(row.artwork_url) ? row.artwork_url : null,
    isPlaying: !!row.is_playing,
    positionMs: Math.max(0, Number(row.position_ms) || 0),
    updatedAt: row.updated_at,
  };
}