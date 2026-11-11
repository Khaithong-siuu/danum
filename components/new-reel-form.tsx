"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Track } from "@/lib/music";
import { MusicPicker, type MusicChoice } from "@/components/music-picker";
import {
  CAPTION_MAX,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
} from "@/lib/reels";
import { processPhoto, type MediaKind } from "@/lib/media";
import {
  FilterStrip,
  MediaActions,
  MediaStage,
  MediaTray,
  useMediaItems,
} from "@/components/media-picker";

type CreateReel = (input: {
  kind: string;
  path: string;
  caption: string;
  durationSeconds: number | null;
  musicTrackId: number | null;
  musicStart: number;
  musicLength: number;
}) => Promise<{ ok: boolean; error?: string }>;

const QUICK_EMOJI = ["🔥", "✨", "❤️", "😂", "🎉", "👏", "🙌", "🎧"];

const ALLOW_LIST: MediaKind[] = ["photo", "video"];

export function NewReelForm({
  userId,
  searchMusic,
  createReel,
}: {
  userId: string;
  searchMusic: (query: string) => Promise<Track[]>;
  createReel: CreateReel;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const media = useMediaItems({
    allow: ALLOW_LIST,
    max: 8,
    maxVideoSeconds: MAX_VIDEO_SECONDS,
    maxVideoBytes: MAX_VIDEO_BYTES,
  });
  const { active } = media;

  const [caption, setCaption] = useState("");
  const [music, setMusic] = useState<MusicChoice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function insertEmoji(emoji: string) {
    setCaption((prev) => (prev ? `${prev} ${emoji}` : emoji));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!active || uploading) return;

    setUploading(true);
    setError(null);
    media.setError(null);

    const kind = active.kind;
    let file = active.file;

    // Photos are shrunk and get their filter baked in before upload
    if (kind === "photo") {
      try {
        file = await processPhoto(active.file, active.filter);
      } catch (err) {
        setUploading(false);
        setError(
          err instanceof Error ? err.message : "We couldn't prepare that photo."
        );
        return;
      }
    }
    const duration = active.duration;

    const rawExt = (file.name.split(".").pop() || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const ext =
      rawExt.length >= 2 && rawExt.length <= 5
        ? rawExt
        : kind === "video"
          ? "mp4"
          : "jpg";

    const path = `${userId}-reel-${Date.now()}.${ext}`;

    // The file goes straight from the phone to storage, so big videos work
    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(path, file, {
        contentType:
          file.type ||
          (ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4"),
        upsert: false,
      });

    if (uploadError) {
      setUploading(false);
      setError("Upload failed. The file may be too large (limit 50 MB for video).");
      return;
    }

    const result = await createReel({
      kind,
      path,
      caption,
      durationSeconds: kind === "video" ? duration : null,
      musicTrackId: music ? music.track.id : null,
      musicStart: music ? music.start : 0,
      musicLength: music ? music.length : 15,
    }).catch(() => ({ ok: false, error: "Could not save your post." }));

    if (!result.ok) {
      setUploading(false);
      setError(result.error ?? "Could not save your post.");
      return;
    }

    router.push("/reels");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Stage */}
      <MediaStage
        item={active}
        shape="post"
        busy={uploading}
        onRemove={active ? () => media.remove(active.id) : undefined}
      />

      {/* Gallery / camera */}
      <MediaActions
        allow={ALLOW_LIST}
        multiple
        disabled={uploading || media.reading}
        onFiles={(files) => void media.add(files)}
      />

      <MediaTray
        items={media.items}
        activeId={active?.id ?? null}
        disabled={uploading}
        onSelect={media.setActiveId}
        onRemove={media.remove}
      />

      {media.reading && (
        <p className="text-center text-xs text-foreground/50">Reading your files…</p>
      )}

      <FilterStrip
        item={active}
        onChange={(filter) => active && media.update(active.id, { filter })}
      />

      {media.items.length > 1 && (
        <p className="px-1 text-center text-xs text-foreground/50">
          Only the highlighted one is shared. Tap another to switch.
        </p>
      )}

      {/* Music (optional for both) */}
      <div className="space-y-2">
        <MusicPicker search={searchMusic} value={music} onChange={setMusic} />
        {active?.kind === "video" && music && (
          <p className="px-1 text-xs text-foreground/50">
            The song replaces the video&apos;s original sound.
          </p>
        )}
      </div>

      {/* Caption */}
      <div className="glass-card rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="reel-caption" className="text-sm font-semibold">
            Caption
          </label>
          <span className="text-xs tabular-nums text-foreground/40">
            {caption.length}/{CAPTION_MAX}
          </span>
        </div>

        <textarea
          id="reel-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={CAPTION_MAX}
          rows={3}
          placeholder="Write a caption…"
          className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 py-2.5 text-sm transition-all focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {QUICK_EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => insertEmoji(emoji)}
              aria-label={`Add ${emoji}`}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.05] text-lg transition hover:scale-110 hover:bg-foreground/[0.1] active:scale-90"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {(error || media.error) && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 animate-in fade-in-0">
          {error || media.error}
        </div>
      )}

      <button
        type="submit"
        disabled={!active || uploading}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
      >
        {uploading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Posting…</span>
          </>
        ) : (
          <span>Share</span>
        )}
      </button>
    </form>
  );
}