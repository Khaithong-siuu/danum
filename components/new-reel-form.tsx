"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Track } from "@/lib/music";
import { MusicPicker, type MusicChoice } from "@/components/music-picker";
import {
  CAPTION_MAX,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  PHOTO_TYPES,
  VIDEO_TYPES,
  type ReelKind,
} from "@/lib/reels";

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

function UploadIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

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

  const [kind, setKind] = useState<ReelKind>("video");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [music, setMusic] = useState<MusicChoice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function insertEmoji(emoji: string) {
    setCaption((prev) => (prev ? `${prev} ${emoji}` : emoji));
  }

  // Free the temporary preview when it changes or the page closes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function resetFile() {
    setFile(null);
    setPreviewUrl(null);
    setDuration(null);
  }

  function chooseKind(next: ReelKind) {
    if (next === kind) return;
    resetFile();
    setError(null);
    setKind(next);
  }

  function processFile(f: File) {
    setError(null);
    resetFile();

    const allowed = kind === "video" ? VIDEO_TYPES : PHOTO_TYPES;
    if (!allowed.includes(f.type)) {
      setError(
        kind === "video"
          ? "Choose an MP4, MOV or WebM video."
          : "Choose a JPG, PNG or WebP photo."
      );
      return;
    }

    const maxBytes = kind === "video" ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (f.size > maxBytes) {
      setError(
        `That file is too large. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`
      );
      return;
    }

    const url = URL.createObjectURL(f);

    if (kind === "photo") {
      setFile(f);
      setPreviewUrl(url);
      return;
    }

    // Read the video length before accepting it
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const seconds = Math.ceil(probe.duration);

      if (!Number.isFinite(seconds) || seconds < 1) {
        setError("We couldn't read that video.");
        URL.revokeObjectURL(url);
        return;
      }
      if (seconds > MAX_VIDEO_SECONDS) {
        setError(
          `Reels can be up to ${MAX_VIDEO_SECONDS} seconds. Yours is ${seconds}.`
        );
        URL.revokeObjectURL(url);
        return;
      }

      setDuration(seconds);
      setFile(f);
      setPreviewUrl(url);
    };
    probe.onerror = () => {
      setError("We couldn't read that video.");
      URL.revokeObjectURL(url);
    };
    probe.src = url;
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || uploading) return;

    setUploading(true);
    setError(null);

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
      .upload(path, file, { contentType: file.type, upsert: false });

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
      {/* Video or photo */}
      <div className="grid grid-cols-2 rounded-2xl bg-foreground/[0.06] p-1 text-sm font-semibold">
        {(
          [
            ["video", "Video reel"],
            ["photo", "Photo post"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => chooseKind(value)}
            className={`rounded-[14px] py-2.5 transition-all duration-200 ${
              kind === value
                ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/[0.06]"
                : "text-foreground/55 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Upload */}
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`group relative flex aspect-[4/3] w-full flex-col items-center justify-center rounded-[28px] border border-dashed p-8 text-center transition-all duration-200 ${
            isDragging
              ? "scale-[1.01] border-brand bg-brand/10"
              : "border-foreground/20 bg-foreground/[0.02] hover:border-brand/50 hover:bg-brand/[0.04]"
          }`}
        >
          <input
            key={kind}
            type="file"
            accept={
              kind === "video"
                ? "video/mp4,video/quicktime,video/webm"
                : "image/jpeg,image/png,image/webp"
            }
            onChange={handleFile}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={kind === "video" ? "Choose a video" : "Choose a photo"}
          />

          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-brand/20 to-brand/5 text-brand ring-1 ring-brand/20 transition-transform group-hover:scale-105">
            <UploadIcon className="h-7 w-7" />
          </div>

          <p className="text-base font-semibold tracking-tight">
            {kind === "video" ? "Choose a video" : "Choose a photo"}
          </p>
          <p className="mt-1 text-sm text-foreground/50">or drag it here</p>
          <p className="mt-4 text-xs text-foreground/40">
            {kind === "video"
              ? `MP4, MOV or WebM · up to ${MAX_VIDEO_SECONDS}s · 50 MB`
              : "JPG, PNG or WebP · up to 10 MB"}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden rounded-[28px] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-foreground/50">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
                {duration ? ` · ${duration}s` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={resetFile}
              className="shrink-0 rounded-full bg-foreground/[0.07] px-3 py-1 text-xs font-semibold transition hover:bg-foreground/[0.12] active:scale-95"
            >
              Change
            </button>
          </div>

          {previewUrl && (
            <div className="relative mx-auto max-w-[280px] overflow-hidden rounded-2xl bg-black ring-1 ring-foreground/10">
              {kind === "video" ? (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  muted
                  className="max-h-[45dvh] w-full object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-[45dvh] w-full object-contain"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Music (optional for both) */}
      <div className="space-y-2">
        <MusicPicker search={searchMusic} value={music} onChange={setMusic} />
        {kind === "video" && music && (
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
              className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/[0.05] text-base transition hover:scale-110 hover:bg-foreground/[0.1] active:scale-90"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 animate-in fade-in-0">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!file || uploading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
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