import { isArtworkUrl, isPreviewUrl } from "@/lib/reels";

export type Track = {
  id: number;
  title: string;
  artist: string;
  previewUrl: string;
  artworkUrl: string | null;
};

type ItunesResult = {
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
};

function toTrack(r: ItunesResult): Track | null {
  if (
    r.kind !== "song" ||
    typeof r.trackId !== "number" ||
    !Number.isInteger(r.trackId) ||
    !r.trackName ||
    !r.artistName ||
    !isPreviewUrl(r.previewUrl)
  ) {
    return null;
  }

  const art = r.artworkUrl100
    ? r.artworkUrl100.replace("100x100bb", "200x200bb")
    : null;

  return {
    id: r.trackId,
    title: r.trackName.slice(0, 200),
    artist: r.artistName.slice(0, 200),
    previewUrl: r.previewUrl,
    artworkUrl: isArtworkUrl(art) ? art : null,
  };
}

async function itunes(url: string): Promise<ItunesResult[]> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) return [];

  // Apple sometimes labels the JSON as text, so parse it by hand
  const body = JSON.parse(await res.text()) as { results?: ItunesResult[] };
  return Array.isArray(body.results) ? body.results : [];
}

/** Search Apple's catalog for songs. */
export async function searchTracks(query: string): Promise<Track[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];

  try {
    const params = new URLSearchParams({
      term: q,
      media: "music",
      entity: "song",
      limit: "25",
    });
    const results = await itunes(`https://itunes.apple.com/search?${params}`);

    return results.flatMap((r) => {
      const t = toTrack(r);
      return t ? [t] : [];
    });
  } catch {
    return [];
  }
}

/** Look one song up by its Apple ID, so saved titles and links are always genuine. */
export async function getTrack(id: number): Promise<Track | null> {
  if (!Number.isInteger(id) || id <= 0) return null;

  try {
    const params = new URLSearchParams({ id: String(id) });
    const results = await itunes(`https://itunes.apple.com/lookup?${params}`);
    const found = results.find((r) => r.trackId === id);
    return found ? toTrack(found) : null;
  } catch {
    return null;
  }
}